-- Keep quantity-managed inventory derived from report history.
-- This repairs any existing drift and makes future report writes atomic with
-- the current-balance projection.

begin;

create temporary table quantity_balance_expected on commit drop as
select
  r.customer_id,
  r.site_id,
  r.asset_type as item_category,
  r.size_label as basket_type,
  sum(r.basket_install_count - r.basket_collect_count)::integer as quantity
from public.container_reports r
where r.asset_type in ('カゴ', '貸出備品')
  and r.customer_id is not null
  and r.site_id is not null
  and btrim(r.size_label) <> ''
group by r.customer_id, r.site_id, r.asset_type, r.size_label;

do $$
begin
  if exists (select 1 from quantity_balance_expected where quantity < 0) then
    raise exception '履歴上、設置台数より引上げ台数が多い管理対象があります。残高の再計算を中止しました。';
  end if;
end;
$$;

-- The report history is the source of truth. Recreate the projection so stale
-- rows (for example a displayed 2 units after all collections) disappear too.
delete from public.basket_balances;

insert into public.basket_balances (
  customer_id,
  site_id,
  company_name,
  site_name,
  item_category,
  basket_type,
  quantity
)
select
  e.customer_id,
  e.site_id,
  case
    when btrim(coalesce(c.previous_name, '')) = '' then c.name
    else c.name || '（旧社名：' || c.previous_name || '）'
  end,
  s.name,
  e.item_category,
  e.basket_type,
  e.quantity
from quantity_balance_expected e
join public.container_customers c on c.id = e.customer_id
join public.container_sites s on s.id = e.site_id and s.customer_id = e.customer_id
where e.quantity > 0;

-- Existing application versions call this after inserting report rows. Make
-- that call idempotent: it now verifies/rebuilds from history instead of adding
-- the same movement a second time.
create or replace function public.apply_quantity_movement(
  p_customer_id uuid,
  p_site_id uuid,
  p_company_name text,
  p_site_name text,
  p_install_count integer,
  p_collect_count integer,
  p_item_category text,
  p_item_type text
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_item_category not in ('カゴ', '貸出備品') then
    raise exception '管理区分が正しくありません。';
  end if;
  if btrim(p_item_type) = '' then
    raise exception '種類を入力してください。';
  end if;
  if p_install_count < 0 or p_collect_count < 0 then
    raise exception '台数には0以上の数を指定してください。';
  end if;

  insert into public.container_item_types (category, name)
  values (p_item_category, btrim(p_item_type))
  on conflict (name) do update
    set category = excluded.category,
        updated_at = now();

  return public.rebuild_quantity_balance(
    p_customer_id,
    p_site_id,
    p_item_category,
    btrim(p_item_type)
  );
end;
$$;

revoke all on function public.apply_quantity_movement(uuid, uuid, text, text, integer, integer, text, text) from public;
grant execute on function public.apply_quantity_movement(uuid, uuid, text, text, integer, integer, text, text) to authenticated;

create or replace function public.sync_quantity_balance_from_report()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.asset_type in ('カゴ', '貸出備品')
    and old.customer_id is not null and old.site_id is not null and btrim(old.size_label) <> '' then
    perform public.rebuild_quantity_balance(
      old.customer_id, old.site_id, old.asset_type, old.size_label
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.asset_type in ('カゴ', '貸出備品')
    and new.customer_id is not null and new.site_id is not null and btrim(new.size_label) <> '' then
    if tg_op <> 'UPDATE' or row(old.customer_id, old.site_id, old.asset_type, old.size_label)
      is distinct from row(new.customer_id, new.site_id, new.asset_type, new.size_label) then
      perform public.rebuild_quantity_balance(
        new.customer_id, new.site_id, new.asset_type, new.size_label
      );
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_quantity_balance_after_report on public.container_reports;
create constraint trigger sync_quantity_balance_after_report
after insert or update or delete on public.container_reports
deferrable initially deferred
for each row execute function public.sync_quantity_balance_from_report();

commit;

-- Verification result shown by the SQL editor after RUN.
select
  c.name as "排出事業者",
  s.name as "現場",
  b.item_category as "区分",
  b.basket_type as "種類",
  b.quantity as "現在台数"
from public.basket_balances b
join public.container_customers c on c.id = b.customer_id
join public.container_sites s on s.id = b.site_id
where c.name like '%中川工業%'
order by s.site_code, b.item_category, b.basket_type;
