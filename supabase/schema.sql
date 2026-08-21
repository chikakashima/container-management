create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('社長', '管理職', '現場責任者', '職人')),
  email text unique,
  phone text,
  assigned_area text,
  created_at timestamptz not null default now()
);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  manager_name text not null,
  supervisor_name text not null,
  start_date date not null,
  due_date date not null,
  status text not null check (status in ('順調', '要確認', '応援必要', '雨天中止', '完了')),
  note text,
  progress_label text,
  latest_report text,
  latest_photo text,
  checked_today boolean not null default false,
  completion_rate integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists site_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  report_title text not null,
  report_text text not null,
  report_type text not null default 'manual',
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists media_files (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  file_type text not null check (file_type in ('photo', 'video')),
  title text not null,
  comment text,
  work_type text,
  urgency text not null check (urgency in ('低', '中', '高', '緊急')),
  uploaded_by uuid references users(id),
  uploaded_at timestamptz not null default now(),
  file_url text not null,
  ai_status text not null default 'pending'
);

create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  worker_id uuid references users(id),
  start_time time not null,
  end_time time not null,
  work_summary text not null,
  workers_count integer not null default 1,
  material_shortage boolean not null default false,
  issue_text text,
  tomorrow_plan text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  alert_type text not null check (alert_type in ('材料不足', '応援必要', '遅延', '危険あり', '未確認', '雨天中止')),
  title text not null,
  detail text not null,
  status text not null default '未対応' check (status in ('未対応', '確認中', '完了')),
  created_at timestamptz not null default now()
);

create table if not exists site_scores (
  site_id uuid primary key references sites(id) on delete cascade,
  score integer not null check (score between 1 and 5),
  label text not null,
  reason text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_sites_status on sites(status);
create index if not exists idx_media_files_site_id on media_files(site_id);
create index if not exists idx_daily_reports_site_id on daily_reports(site_id);
create index if not exists idx_alerts_site_id on alerts(site_id);

