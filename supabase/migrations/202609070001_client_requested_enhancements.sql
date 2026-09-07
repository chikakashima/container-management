-- Client-requested production enhancements:
-- drivers, quantity-managed item masters, lending equipment, master edits,
-- report deletion with audit, and same-container collection/reinstallation.
-- Run after 202609050002_report_corrections.sql.

begin;

alter table public.container_customers
  add column if not exists previous_name text not null default '';

create table if not exists public.container_drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.container_item_types (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('カゴ', '貸出備品')),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_container_drivers_updated_at on public.container_drivers;
create trigger set_container_drivers_updated_at before update on public.container_drivers
for each row execute function public.set_updated_at();

drop trigger if exists set_container_item_types_updated_at on public.container_item_types;
create trigger set_container_item_types_updated_at before update on public.container_item_types
for each row execute function public.set_updated_at();

alter table public.container_drivers enable row level security;
alter table public.container_item_types enable row level security;

drop policy if exists "authenticated users manage drivers" on public.container_drivers;
create policy "authenticated users manage drivers" on public.container_drivers
for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users manage item types" on public.container_item_types;
create policy "authenticated users manage item types" on public.container_item_types
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on table public.container_drivers to authenticated;
grant select, insert, update, delete on table public.container_item_types to authenticated;

insert into public.container_drivers (name)
select distinct btrim(driver_name)
from public.container_reports
where btrim(driver_name) <> ''
on conflict (name) do nothing;

alter table public.container_reports
  drop constraint if exists container_reports_asset_type_check;
alter table public.container_reports
  add constraint container_reports_asset_type_check
  check (asset_type in ('コンテナ', 'カゴ', '貸出備品', '手積み'));

alter table public.basket_balances
  add column if not exists item_category text not null default 'カゴ';
alter table public.basket_balances
  drop constraint if exists basket_balances_item_category_check;
alter table public.basket_balances
  add constraint basket_balances_item_category_check
  check (item_category in ('カゴ', '貸出備品'));

-- These names were previously stored under the generic basket category.
update public.container_reports
set asset_type = '貸出備品'
where asset_type = 'カゴ'
  and size_label in ('シート', 'シート(8㎥)', 'ブルーシート', 'ドラム缶', 'キーパー');

update public.basket_balances
set item_category = '貸出備品'
where basket_type in ('シート', 'シート(8㎥)', 'ブルーシート', 'ドラム缶', 'キーパー');

insert into public.container_item_types (category, name) values
  ('カゴ', 'カゴ'),
  ('カゴ', '1.5㎥カゴ'),
  ('カゴ', 'IBCコンテナ'),
  ('カゴ', 'ネット'),
  ('カゴ', 'ネット(8㎥)'),
  ('カゴ', '黒ネット'),
  ('カゴ', '岩本コンテナ'),
  ('カゴ', '山畑コンテナ（4㎥）'),
  ('カゴ', '宇賀神カゴ'),
  ('カゴ', 'GOKO(4㎥)'),
  ('貸出備品', 'シート'),
  ('貸出備品', 'シート(8㎥)'),
  ('貸出備品', 'ブルーシート'),
  ('貸出備品', 'ドラム缶'),
  ('貸出備品', 'キーパー')
on conflict (name) do update set category = excluded.category;

insert into public.container_item_types (category, name)
select distinct
  case when asset_type = '貸出備品' then '貸出備品' else 'カゴ' end,
  btrim(size_label)
from public.container_reports
where asset_type in ('カゴ', '貸出備品') and btrim(size_label) <> ''
on conflict (name) do nothing;

insert into public.container_item_types (category, name)
select distinct item_category, btrim(basket_type)
from public.basket_balances
where btrim(basket_type) <> ''
on conflict (name) do nothing;

-- Keep correction audits after the source report is deleted.
alter table public.container_report_corrections
  add column if not exists original_report_id text;
update public.container_report_corrections
set original_report_id = report_id
where original_report_id is null;
alter table public.container_report_corrections
  alter column report_id drop not null;
alter table public.container_report_corrections
  drop constraint if exists container_report_corrections_report_id_fkey;
alter table public.container_report_corrections
  add constraint container_report_corrections_report_id_fkey
  foreign key (report_id) references public.container_reports(id)
  on update cascade on delete set null;

create table if not exists public.container_report_deletions (
  id uuid primary key default gen_random_uuid(),
  report_id text not null,
  deleted_by uuid not null default auth.uid(),
  before_data jsonb not null,
  deleted_at timestamptz not null default now()
);

create index if not exists container_report_deletions_report_idx
  on public.container_report_deletions (report_id, deleted_at desc);

alter table public.container_report_deletions enable row level security;
drop policy if exists "authenticated users read report deletions" on public.container_report_deletions;
create policy "authenticated users read report deletions"
on public.container_report_deletions for select to authenticated using (true);
drop policy if exists "authenticated users insert report deletions" on public.container_report_deletions;
create policy "authenticated users insert report deletions"
on public.container_report_deletions for insert to authenticated
with check (deleted_by = auth.uid());
grant select, insert on table public.container_report_deletions to authenticated;

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
declare
  next_quantity integer;
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
  on conflict (name) do update set category = excluded.category, updated_at = now();

  insert into public.basket_balances (
    customer_id, site_id, company_name, site_name,
    item_category, basket_type, quantity
  ) values (
    p_customer_id, p_site_id, p_company_name, p_site_name,
    p_item_category, btrim(p_item_type), p_install_count - p_collect_count
  )
  on conflict (customer_id, site_id, basket_type) do update
    set quantity = public.basket_balances.quantity + excluded.quantity,
        company_name = excluded.company_name,
        site_name = excluded.site_name,
        item_category = excluded.item_category,
        updated_at = now()
    where public.basket_balances.quantity + excluded.quantity >= 0
  returning quantity into next_quantity;

  if next_quantity is null or next_quantity < 0 then
    raise exception '現在の設置台数を超えて引上げることはできません。';
  end if;
  return next_quantity;
end;
$$;

revoke all on function public.apply_quantity_movement(uuid, uuid, text, text, integer, integer, text, text) from public;
grant execute on function public.apply_quantity_movement(uuid, uuid, text, text, integer, integer, text, text) to authenticated;

create or replace function public.rebuild_quantity_balance(
  p_customer_id uuid,
  p_site_id uuid,
  p_item_category text,
  p_item_type text
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_quantity integer;
  canonical_company_name text;
  canonical_site_name text;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'quantity:' || p_customer_id::text || ':' || p_site_id::text || ':' || p_item_category || ':' || p_item_type,
    0
  ));

  select
    case when btrim(c.previous_name) = '' then c.name
      else c.name || '（旧社名：' || c.previous_name || '）' end,
    s.name
  into canonical_company_name, canonical_site_name
  from public.container_customers c
  join public.container_sites s on s.customer_id = c.id
  where c.id = p_customer_id and s.id = p_site_id;

  if canonical_company_name is null then
    raise exception '排出事業者と現場の組み合わせが正しくありません。';
  end if;

  select coalesce(sum(r.basket_install_count - r.basket_collect_count), 0)::integer
  into next_quantity
  from public.container_reports r
  where r.asset_type = p_item_category
    and r.customer_id = p_customer_id
    and r.site_id = p_site_id
    and r.size_label = p_item_type;

  if next_quantity < 0 then
    raise exception '訂正後の設置台数が0未満になるため保存できません。';
  end if;

  if next_quantity = 0 then
    delete from public.basket_balances
    where customer_id = p_customer_id and site_id = p_site_id and basket_type = p_item_type;
  else
    insert into public.basket_balances (
      customer_id, site_id, company_name, site_name,
      item_category, basket_type, quantity
    ) values (
      p_customer_id, p_site_id, canonical_company_name, canonical_site_name,
      p_item_category, p_item_type, next_quantity
    )
    on conflict (customer_id, site_id, basket_type) do update
      set company_name = excluded.company_name,
          site_name = excluded.site_name,
          item_category = excluded.item_category,
          quantity = excluded.quantity,
          updated_at = now();
  end if;
  return next_quantity;
end;
$$;

revoke all on function public.rebuild_quantity_balance(uuid, uuid, text, text) from public;
grant execute on function public.rebuild_quantity_balance(uuid, uuid, text, text) to authenticated;

create or replace function public.update_container_customer_master(
  p_customer_id uuid,
  p_customer_code text,
  p_name text,
  p_name_kana text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_customer public.container_customers%rowtype;
  updated_customer public.container_customers%rowtype;
begin
  select * into current_customer from public.container_customers
  where id = p_customer_id for update;
  if current_customer.id is null then
    raise exception '排出事業者が見つかりません。';
  end if;
  if btrim(p_customer_code) = '' or btrim(p_name) = '' then
    raise exception '顧客番号と排出事業者名を入力してください。';
  end if;

  update public.container_customers
  set customer_code = btrim(p_customer_code),
      previous_name = case
        when btrim(p_name) <> current_customer.name then current_customer.name
        else current_customer.previous_name
      end,
      name = btrim(p_name),
      name_kana = btrim(coalesce(p_name_kana, ''))
  where id = p_customer_id
  returning * into updated_customer;

  return to_jsonb(updated_customer);
end;
$$;

revoke all on function public.update_container_customer_master(uuid, text, text, text) from public;
grant execute on function public.update_container_customer_master(uuid, text, text, text) to authenticated;

create or replace function public.update_container_site_master(
  p_site_id uuid,
  p_site_code text,
  p_name text,
  p_name_kana text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_site public.container_sites%rowtype;
begin
  if btrim(p_site_code) = '' or btrim(p_name) = '' then
    raise exception '現場番号と現場名を入力してください。';
  end if;

  update public.container_sites
  set site_code = btrim(p_site_code),
      name = btrim(p_name),
      name_kana = btrim(coalesce(p_name_kana, ''))
  where id = p_site_id
  returning * into updated_site;

  if updated_site.id is null then
    raise exception '現場が見つかりません。';
  end if;
  return to_jsonb(updated_site);
end;
$$;

revoke all on function public.update_container_site_master(uuid, text, text, text) from public;
grant execute on function public.update_container_site_master(uuid, text, text, text) to authenticated;

create or replace function public.correct_container_report_v2(
  p_report_id text,
  p_work_date date,
  p_customer_id uuid,
  p_site_id uuid,
  p_driver_name text,
  p_install_asset_id text,
  p_install_asset_label text,
  p_collect_asset_id text,
  p_collect_asset_label text,
  p_quantity text,
  p_note text,
  p_quantity_install_count integer,
  p_quantity_collect_count integer,
  p_asset_type text,
  p_size_label text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_report public.container_reports%rowtype;
  new_report public.container_reports%rowtype;
  target_asset_id text;
  asset_warnings text[];
  warnings text[] := array[]::text[];
  canonical_company_name text;
  canonical_site_name text;
  next_work_type text;
  next_asset_type text;
  next_size_label text;
begin
  if p_report_id like 'initial-report-%' then
    raise exception '初期登録データはこの画面から訂正できません。';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('report:' || p_report_id, 0));
  select * into old_report from public.container_reports
  where id = p_report_id for update;
  if old_report.id is null then
    raise exception '訂正対象の入力履歴が見つかりません。';
  end if;
  if p_work_date is null or btrim(p_driver_name) = '' then
    raise exception '日付とドライバー名を入力してください。';
  end if;

  select
    case when btrim(c.previous_name) = '' then c.name
      else c.name || '（旧社名：' || c.previous_name || '）' end,
    s.name
  into canonical_company_name, canonical_site_name
  from public.container_customers c
  join public.container_sites s on s.customer_id = c.id
  where c.id = p_customer_id and s.id = p_site_id;
  if canonical_company_name is null then
    raise exception '排出事業者と現場の組み合わせが正しくありません。';
  end if;

  if p_asset_type in ('カゴ', '貸出備品') then
    if p_quantity_install_count < 0 or p_quantity_collect_count < 0 then
      raise exception '台数には0以上の数を指定してください。';
    end if;
    if p_quantity_install_count = 0 and p_quantity_collect_count = 0 then
      raise exception '設置または引上げ台数を入力してください。';
    end if;
    if btrim(p_size_label) = '' then
      raise exception '種類を入力してください。';
    end if;
    next_asset_type := p_asset_type;
    next_size_label := btrim(p_size_label);
    next_work_type := case
      when p_quantity_install_count > 0 and p_quantity_collect_count > 0 then '交換'
      when p_quantity_install_count > 0 then '設置'
      when p_quantity_collect_count > 0 then '回収'
      else '手積み'
    end;
  else
    if p_install_asset_id is null and p_collect_asset_id is null and btrim(coalesce(p_quantity, '')) = '' then
      raise exception '設置・引上げ・受託数量のいずれかを入力してください。';
    end if;
    if p_install_asset_id is not null then
      insert into public.container_assets (id, label, asset_type, size_label)
      values (p_install_asset_id, p_install_asset_label, 'コンテナ', '')
      on conflict (id) do update set label = excluded.label, updated_at = now();
    end if;
    if p_collect_asset_id is not null then
      insert into public.container_assets (id, label, asset_type, size_label)
      values (p_collect_asset_id, p_collect_asset_label, 'コンテナ', '')
      on conflict (id) do update set label = excluded.label, updated_at = now();
    end if;
    next_asset_type := case when p_install_asset_id is null and p_collect_asset_id is null then '手積み' else 'コンテナ' end;
    next_size_label := case when next_asset_type = '手積み' then '手積み' else '' end;
    next_work_type := case
      when p_install_asset_id is not null and p_collect_asset_id is not null then '交換'
      when p_install_asset_id is not null then '設置'
      when p_collect_asset_id is not null then '回収'
      else '手積み'
    end;
  end if;

  update public.container_reports
  set work_date = p_work_date,
      customer_id = p_customer_id,
      company_name = case
        when old_report.customer_id = p_customer_id then old_report.company_name
        else canonical_company_name
      end,
      site_id = p_site_id,
      site_name = case
        when old_report.site_id = p_site_id then old_report.site_name
        else canonical_site_name
      end,
      driver_name = btrim(p_driver_name),
      work_type = next_work_type,
      install_asset_id = case when next_asset_type = 'コンテナ' then p_install_asset_id else null end,
      install_asset_label = case when next_asset_type = 'コンテナ' then p_install_asset_label else null end,
      collect_asset_id = case when next_asset_type = 'コンテナ' then p_collect_asset_id else null end,
      collect_asset_label = case when next_asset_type = 'コンテナ' then p_collect_asset_label else null end,
      asset_type = next_asset_type,
      size_label = next_size_label,
      quantity = coalesce(p_quantity, ''),
      note = nullif(btrim(coalesce(p_note, '')), ''),
      basket_install_count = case when next_asset_type in ('カゴ', '貸出備品') then p_quantity_install_count else 0 end,
      basket_collect_count = case when next_asset_type in ('カゴ', '貸出備品') then p_quantity_collect_count else 0 end
  where id = p_report_id
  returning * into new_report;

  insert into public.container_report_corrections (
    report_id, original_report_id, corrected_by, before_data, after_data
  ) values (
    p_report_id, p_report_id, auth.uid(), to_jsonb(old_report), to_jsonb(new_report)
  );

  if old_report.asset_type not in ('カゴ', '貸出備品') then
    for target_asset_id in
      select distinct value from unnest(array[old_report.install_asset_id, old_report.collect_asset_id]) affected(value)
      where value is not null
    loop
      asset_warnings := public.rebuild_container_asset(target_asset_id);
      warnings := warnings || coalesce(asset_warnings, array[]::text[]);
    end loop;
  else
    perform public.rebuild_quantity_balance(old_report.customer_id, old_report.site_id, old_report.asset_type, old_report.size_label);
  end if;

  if new_report.asset_type not in ('カゴ', '貸出備品') then
    for target_asset_id in
      select distinct value from unnest(array[new_report.install_asset_id, new_report.collect_asset_id]) affected(value)
      where value is not null
    loop
      asset_warnings := public.rebuild_container_asset(target_asset_id);
      warnings := warnings || coalesce(asset_warnings, array[]::text[]);
    end loop;
  else
    perform public.rebuild_quantity_balance(new_report.customer_id, new_report.site_id, new_report.asset_type, new_report.size_label);
  end if;

  return jsonb_build_object('warnings', to_jsonb(array(select distinct unnest(warnings))));
end;
$$;

revoke all on function public.correct_container_report_v2(
  text, date, uuid, uuid, text, text, text, text, text, text, text, integer, integer, text, text
) from public;
grant execute on function public.correct_container_report_v2(
  text, date, uuid, uuid, text, text, text, text, text, text, text, integer, integer, text, text
) to authenticated;

create or replace function public.delete_container_report(p_report_id text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_report public.container_reports%rowtype;
  target_asset_id text;
  asset_warnings text[];
  warnings text[] := array[]::text[];
begin
  if p_report_id like 'initial-report-%' then
    raise exception '初期登録データはこの画面から削除できません。';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('report:' || p_report_id, 0));
  select * into old_report from public.container_reports
  where id = p_report_id for update;
  if old_report.id is null then
    raise exception '削除対象の入力履歴が見つかりません。';
  end if;

  insert into public.container_report_deletions (report_id, deleted_by, before_data)
  values (p_report_id, auth.uid(), to_jsonb(old_report));

  delete from public.container_assignments where source_report_id = p_report_id;
  delete from public.container_reports where id = p_report_id;

  if old_report.asset_type in ('カゴ', '貸出備品') then
    perform public.rebuild_quantity_balance(old_report.customer_id, old_report.site_id, old_report.asset_type, old_report.size_label);
  else
    for target_asset_id in
      select distinct value from unnest(array[old_report.install_asset_id, old_report.collect_asset_id]) affected(value)
      where value is not null
    loop
      asset_warnings := public.rebuild_container_asset(target_asset_id);
      warnings := warnings || coalesce(asset_warnings, array[]::text[]);
    end loop;
  end if;

  return jsonb_build_object('warnings', to_jsonb(warnings));
end;
$$;

revoke all on function public.delete_container_report(text) from public;
grant execute on function public.delete_container_report(text) to authenticated;

commit;
