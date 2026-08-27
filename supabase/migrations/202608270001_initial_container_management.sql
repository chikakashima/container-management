-- Container management production schema
-- Run this migration in the dedicated Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.container_assets (
  id text primary key,
  label text not null unique,
  asset_type text not null check (asset_type in ('コンテナ', 'カゴ')),
  size_label text not null default '',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.container_assignments (
  id text primary key,
  asset_id text not null references public.container_assets(id) on update cascade on delete restrict,
  asset_label text not null,
  asset_type text not null check (asset_type in ('コンテナ', 'カゴ')),
  size_label text not null default '',
  company_name text not null,
  site_name text not null default '',
  installed_on date not null,
  collected_on date,
  quantity text not null default '',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (collected_on is null or collected_on >= installed_on)
);

create unique index if not exists one_active_assignment_per_asset
  on public.container_assignments (asset_id)
  where collected_on is null;

create index if not exists container_assignments_company_idx
  on public.container_assignments (company_name);

create index if not exists container_assignments_installed_on_idx
  on public.container_assignments (installed_on);

create table if not exists public.container_reports (
  id text primary key,
  work_date date not null,
  company_name text not null,
  site_name text not null default '',
  driver_name text not null,
  work_type text not null check (work_type in ('設置', '回収', '交換', '手積み')),
  install_asset_id text references public.container_assets(id) on update cascade on delete restrict,
  install_asset_label text,
  collect_asset_id text references public.container_assets(id) on update cascade on delete restrict,
  collect_asset_label text,
  asset_type text not null check (asset_type in ('コンテナ', 'カゴ', '手積み')),
  size_label text not null default '',
  quantity text not null default '',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists container_reports_work_date_idx
  on public.container_reports (work_date desc);

create index if not exists container_reports_company_idx
  on public.container_reports (company_name);

create index if not exists container_reports_install_asset_idx
  on public.container_reports (install_asset_id);

create index if not exists container_reports_collect_asset_idx
  on public.container_reports (collect_asset_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_container_assets_updated_at on public.container_assets;
create trigger set_container_assets_updated_at
before update on public.container_assets
for each row execute function public.set_updated_at();

drop trigger if exists set_container_assignments_updated_at on public.container_assignments;
create trigger set_container_assignments_updated_at
before update on public.container_assignments
for each row execute function public.set_updated_at();

drop trigger if exists set_container_reports_updated_at on public.container_reports;
create trigger set_container_reports_updated_at
before update on public.container_reports
for each row execute function public.set_updated_at();

alter table public.container_assets enable row level security;
alter table public.container_assignments enable row level security;
alter table public.container_reports enable row level security;

drop policy if exists "authenticated users manage assets" on public.container_assets;
create policy "authenticated users manage assets"
on public.container_assets
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users manage assignments" on public.container_assignments;
create policy "authenticated users manage assignments"
on public.container_assignments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users manage reports" on public.container_reports;
create policy "authenticated users manage reports"
on public.container_reports
for all
to authenticated
using (true)
with check (true);

revoke all on table public.container_assets from anon;
revoke all on table public.container_assignments from anon;
revoke all on table public.container_reports from anon;

grant select, insert, update, delete on table public.container_assets to authenticated;
grant select, insert, update, delete on table public.container_assignments to authenticated;
grant select, insert, update, delete on table public.container_reports to authenticated;
