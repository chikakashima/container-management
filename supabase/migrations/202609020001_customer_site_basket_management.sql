-- Customer/site masters, kana search data and quantity-based basket management.
-- Run after 202608270001_initial_container_management.sql.

create table if not exists public.container_customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique,
  name text not null,
  name_kana text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists container_customers_name_idx on public.container_customers (name);
create index if not exists container_customers_kana_idx on public.container_customers (name_kana);

create table if not exists public.container_sites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.container_customers(id) on update cascade on delete restrict,
  site_code text not null,
  name text not null,
  name_kana text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, site_code)
);

create index if not exists container_sites_customer_idx on public.container_sites (customer_id);
create index if not exists container_sites_name_idx on public.container_sites (name);
create index if not exists container_sites_kana_idx on public.container_sites (name_kana);

alter table public.container_assignments
  add column if not exists customer_id uuid references public.container_customers(id) on update cascade on delete restrict,
  add column if not exists site_id uuid references public.container_sites(id) on update cascade on delete restrict,
  add column if not exists source_report_id text references public.container_reports(id) on update cascade on delete restrict;

create unique index if not exists container_assignments_source_report_idx
  on public.container_assignments (source_report_id)
  where source_report_id is not null;

alter table public.container_reports
  add column if not exists customer_id uuid references public.container_customers(id) on update cascade on delete restrict,
  add column if not exists site_id uuid references public.container_sites(id) on update cascade on delete restrict,
  add column if not exists basket_install_count integer not null default 0 check (basket_install_count >= 0),
  add column if not exists basket_collect_count integer not null default 0 check (basket_collect_count >= 0),
  add column if not exists entry_order integer not null default 0;

create table if not exists public.basket_balances (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.container_customers(id) on update cascade on delete restrict,
  site_id uuid not null references public.container_sites(id) on update cascade on delete restrict,
  company_name text not null,
  site_name text not null,
  basket_type text not null default 'カゴ',
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, site_id, basket_type)
);

create index if not exists basket_balances_customer_site_idx
  on public.basket_balances (customer_id, site_id);

drop trigger if exists set_container_customers_updated_at on public.container_customers;
create trigger set_container_customers_updated_at before update on public.container_customers
for each row execute function public.set_updated_at();

drop trigger if exists set_container_sites_updated_at on public.container_sites;
create trigger set_container_sites_updated_at before update on public.container_sites
for each row execute function public.set_updated_at();

drop trigger if exists set_basket_balances_updated_at on public.basket_balances;
create trigger set_basket_balances_updated_at before update on public.basket_balances
for each row execute function public.set_updated_at();

alter table public.container_customers enable row level security;
alter table public.container_sites enable row level security;
alter table public.basket_balances enable row level security;

drop policy if exists "authenticated users manage customers" on public.container_customers;
create policy "authenticated users manage customers" on public.container_customers
for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users manage sites" on public.container_sites;
create policy "authenticated users manage sites" on public.container_sites
for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users manage basket balances" on public.basket_balances;
create policy "authenticated users manage basket balances" on public.basket_balances
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on table public.container_customers to authenticated;
grant select, insert, update, delete on table public.container_sites to authenticated;
grant select, insert, update, delete on table public.basket_balances to authenticated;

create or replace function public.apply_basket_movement(
  p_customer_id uuid,
  p_site_id uuid,
  p_company_name text,
  p_site_name text,
  p_install_count integer,
  p_collect_count integer,
  p_basket_type text default 'カゴ'
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_quantity integer;
begin
  if p_install_count < 0 or p_collect_count < 0 then
    raise exception '台数には0以上の数を指定してください。';
  end if;

  insert into public.basket_balances (
    customer_id, site_id, company_name, site_name, basket_type, quantity
  ) values (
    p_customer_id, p_site_id, p_company_name, p_site_name, p_basket_type,
    p_install_count - p_collect_count
  )
  on conflict (customer_id, site_id, basket_type) do update
    set quantity = public.basket_balances.quantity + excluded.quantity,
        company_name = excluded.company_name,
        site_name = excluded.site_name,
        updated_at = now()
    where public.basket_balances.quantity + excluded.quantity >= 0
  returning quantity into next_quantity;

  if next_quantity is null or next_quantity < 0 then
    raise exception '現在の設置台数を超えて引上げることはできません。';
  end if;

  return next_quantity;
end;
$$;

grant execute on function public.apply_basket_movement(uuid, uuid, text, text, integer, integer, text) to authenticated;

-- Rebuild an asset's end-of-day assignment from every report registered for that
-- day. This makes the result independent of the order in which each driver's
-- paper report is entered.
create or replace function public.reconcile_container_day(
  p_work_date date,
  p_asset_ids text[]
)
returns table (asset_id text, status text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_asset_id text;
  install_count integer;
  collect_count integer;
  prior_assignment public.container_assignments%rowtype;
  install_report public.container_reports%rowtype;
begin
  foreach target_asset_id in array p_asset_ids loop
    perform pg_advisory_xact_lock(hashtextextended(target_asset_id || ':' || p_work_date::text, 0));

    -- Remove a result previously calculated for this day. An earlier
    -- assignment whose collected_on equals this day remains eligible as the
    -- start-of-day assignment, so no temporary reset to null is needed.
    delete from public.container_assignments a
      where a.asset_id = target_asset_id
        and a.source_report_id in (
          select r.id from public.container_reports r
          where r.work_date = p_work_date and r.install_asset_id = target_asset_id
        );

    select count(*)
      into install_count
      from public.container_reports r
      where r.work_date = p_work_date and r.install_asset_id = target_asset_id;

    select count(*)
      into collect_count
      from public.container_reports r
      where r.work_date = p_work_date and r.collect_asset_id = target_asset_id;

    select r.* into install_report
      from public.container_reports r
      where r.work_date = p_work_date and r.install_asset_id = target_asset_id
      order by r.entry_order desc, r.created_at desc
      limit 1;

    select a.* into prior_assignment
      from public.container_assignments a
      where a.asset_id = target_asset_id
        and a.installed_on <= p_work_date
        and (a.collected_on is null or a.collected_on >= p_work_date)
      order by a.installed_on desc, a.created_at desc
      limit 1;

    if prior_assignment.id is not null and collect_count > 0 then
      update public.container_assignments
        set collected_on = p_work_date
        where id = prior_assignment.id;
    end if;

    if install_count > 0 and (prior_assignment.id is null or collect_count > 0) then
      insert into public.container_assignments (
        id, asset_id, asset_label, asset_type, size_label,
        customer_id, company_name, site_id, site_name,
        installed_on, collected_on, quantity, note, source_report_id
      ) values (
        'assign-report-' || md5(install_report.id),
        install_report.install_asset_id,
        install_report.install_asset_label,
        'コンテナ',
        install_report.size_label,
        install_report.customer_id,
        install_report.company_name,
        install_report.site_id,
        install_report.site_name,
        p_work_date,
        case when prior_assignment.id is null and collect_count > 0 then p_work_date else null end,
        install_report.quantity,
        install_report.note,
        install_report.id
      );
    end if;

    asset_id := target_asset_id;
    status := case
      when install_count > 1 then '同日に設置が複数登録されています'
      when collect_count > 1 then '同日に引上げが複数登録されています'
      when prior_assignment.id is not null and install_count > 0 and collect_count = 0 then '同日の引上げ入力待ち'
      when prior_assignment.id is null and collect_count > 0 and install_count = 0 then '同日の設置入力待ち'
      else '反映済み'
    end;
    return next;
  end loop;
end;
$$;

grant execute on function public.reconcile_container_day(date, text[]) to authenticated;
