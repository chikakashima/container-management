-- Client-requested master maintenance and canonical item names.
-- Run after 202609070001_client_requested_enhancements.sql.

begin;

-- Remove the migration-only driver label from future selections.
delete from public.container_drivers where name = '初期登録';

create temporary table item_name_cleanup (
  old_name text primary key,
  canonical_name text not null,
  canonical_category text not null
) on commit drop;

insert into item_name_cleanup (old_name, canonical_name, canonical_category) values
  ('1.5カゴ', '1.5㎥カゴ', 'カゴ'),
  ('1.5㎥カゴ', '1.5㎥カゴ', 'カゴ'),
  ('GOKO（4M3）', 'GOKO（4㎥）', 'カゴ'),
  ('GOKO(4M3)', 'GOKO（4㎥）', 'カゴ'),
  ('GOKO(4㎥)', 'GOKO（4㎥）', 'カゴ'),
  ('GOKO（4㎥）', 'GOKO（4㎥）', 'カゴ'),
  ('シート（8M3）', 'シート（8㎥）', '貸出備品'),
  ('シート(8M3)', 'シート（8㎥）', '貸出備品'),
  ('シート(8㎥)', 'シート（8㎥）', '貸出備品'),
  ('シート', 'シート（8㎥）', '貸出備品'),
  ('シート（8㎥）', 'シート（8㎥）', '貸出備品'),
  ('ネット', 'ネット（8㎥）', '貸出備品'),
  ('ネット（8M3）', 'ネット（8㎥）', '貸出備品'),
  ('ネット(8M3)', 'ネット（8㎥）', '貸出備品'),
  ('ネット(8㎥)', 'ネット（8㎥）', '貸出備品'),
  ('ネット（8㎥）', 'ネット（8㎥）', '貸出備品'),
  ('黒ネット', 'ネット（8㎥）', '貸出備品'),
  ('山畑コンテナ（4M3）', '山畑コンテナ（4㎥）', 'カゴ'),
  ('山畑コンテナ(4M3)', '山畑コンテナ（4㎥）', 'カゴ'),
  ('山畑コンテナ(4㎥)', '山畑コンテナ（4㎥）', 'カゴ'),
  ('山畑コンテナ（4㎥）', '山畑コンテナ（4㎥）', 'カゴ');

update public.container_reports r
set size_label = m.canonical_name,
    asset_type = m.canonical_category
from item_name_cleanup m
where r.asset_type in ('カゴ', '貸出備品')
  and r.size_label = m.old_name;

-- Rebuild canonical balances from the now-normalized report history.
insert into public.basket_balances (
  customer_id, site_id, company_name, site_name,
  item_category, basket_type, quantity
)
select
  r.customer_id,
  r.site_id,
  max(r.company_name),
  max(r.site_name),
  r.asset_type,
  r.size_label,
  sum(r.basket_install_count - r.basket_collect_count)::integer
from public.container_reports r
where r.asset_type in ('カゴ', '貸出備品')
  and r.customer_id is not null
  and r.site_id is not null
  and exists (select 1 from item_name_cleanup m where m.canonical_name = r.size_label)
group by r.customer_id, r.site_id, r.asset_type, r.size_label
having sum(r.basket_install_count - r.basket_collect_count) > 0
on conflict (customer_id, site_id, basket_type) do update
set company_name = excluded.company_name,
    site_name = excluded.site_name,
    item_category = excluded.item_category,
    quantity = excluded.quantity,
    updated_at = now();

delete from public.basket_balances b
using item_name_cleanup m
where b.basket_type = m.old_name
  and b.basket_type <> m.canonical_name;

update public.basket_balances b
set basket_type = m.canonical_name,
    item_category = m.canonical_category,
    updated_at = now()
from item_name_cleanup m
where b.basket_type = m.old_name;

delete from public.container_item_types t
using item_name_cleanup m
where t.name = m.old_name
  and t.name <> m.canonical_name;

insert into public.container_item_types (category, name)
select distinct canonical_category, canonical_name
from item_name_cleanup
on conflict (name) do update
set category = excluded.category,
    updated_at = now();

create or replace function public.rename_container_item_type(
  p_item_type_id uuid,
  p_category text,
  p_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_item public.container_item_types%rowtype;
  next_name text := btrim(p_name);
begin
  if p_category not in ('カゴ', '貸出備品') then
    raise exception '区分が正しくありません。';
  end if;
  if next_name = '' then
    raise exception '種類名を入力してください。';
  end if;

  select * into current_item
  from public.container_item_types
  where id = p_item_type_id
  for update;
  if current_item.id is null then
    raise exception '種類が見つかりません。';
  end if;

  update public.container_reports
  set asset_type = p_category,
      size_label = next_name
  where asset_type in ('カゴ', '貸出備品')
    and size_label = current_item.name;

  if current_item.name <> next_name then
    insert into public.basket_balances (
      customer_id, site_id, company_name, site_name,
      item_category, basket_type, quantity
    )
    select customer_id, site_id, max(company_name), max(site_name),
      p_category, next_name, sum(quantity)::integer
    from public.basket_balances
    where basket_type in (current_item.name, next_name)
    group by customer_id, site_id
    on conflict (customer_id, site_id, basket_type) do update
    set company_name = excluded.company_name,
        site_name = excluded.site_name,
        item_category = excluded.item_category,
        quantity = excluded.quantity,
        updated_at = now();

    delete from public.basket_balances where basket_type = current_item.name;
  else
    update public.basket_balances
    set item_category = p_category, updated_at = now()
    where basket_type = current_item.name;
  end if;

  delete from public.container_item_types
  where name = next_name and id <> current_item.id;

  update public.container_item_types
  set category = p_category, name = next_name, updated_at = now()
  where id = current_item.id;

  return jsonb_build_object('id', current_item.id, 'category', p_category, 'name', next_name);
end;
$$;

create or replace function public.delete_container_item_type(p_item_type_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_item public.container_item_types%rowtype;
begin
  select * into current_item
  from public.container_item_types
  where id = p_item_type_id
  for update;
  if current_item.id is null then
    raise exception '種類が見つかりません。';
  end if;
  if exists (
    select 1 from public.container_reports
    where asset_type in ('カゴ', '貸出備品') and size_label = current_item.name
  ) or exists (
    select 1 from public.basket_balances
    where basket_type = current_item.name and quantity <> 0
  ) then
    raise exception 'この種類は履歴または設置台数で使用されています。削除ではなく名称修正をご利用ください。';
  end if;
  delete from public.container_item_types where id = p_item_type_id;
end;
$$;

revoke all on function public.rename_container_item_type(uuid, text, text) from public;
grant execute on function public.rename_container_item_type(uuid, text, text) to authenticated;
revoke all on function public.delete_container_item_type(uuid) from public;
grant execute on function public.delete_container_item_type(uuid) to authenticated;

commit;
