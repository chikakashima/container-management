alter table public.container_assets
  add column if not exists is_active boolean not null default true;

create index if not exists container_assets_active_label_idx
  on public.container_assets (is_active, label);

create or replace function public.rename_numbered_container(
  p_asset_id text,
  p_new_label text,
  p_size_label text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_asset public.container_assets%rowtype;
  normalized_label text;
  new_asset_id text;
begin
  select * into current_asset
  from public.container_assets
  where id = p_asset_id and asset_type = 'コンテナ'
  for update;

  if not found then
    raise exception '対象のコンテナ番号が見つかりません。';
  end if;

  normalized_label := upper(regexp_replace(trim(p_new_label), '[^A-Za-z0-9]', '', 'g'));
  if normalized_label = '' then
    raise exception 'コンテナ番号を入力してください。';
  end if;
  if p_size_label not in ('', '4㎥', '8㎥') then
    raise exception '種類は4㎥または8㎥を指定してください。';
  end if;

  new_asset_id := 'container-' || lower(normalized_label);
  if new_asset_id <> p_asset_id and exists (
    select 1 from public.container_assets where id = new_asset_id or label = normalized_label
  ) then
    raise exception 'コンテナ番号「%」はすでに登録されています。', normalized_label;
  end if;

  update public.container_assets
  set id = new_asset_id,
      label = normalized_label,
      size_label = p_size_label,
      updated_at = now()
  where id = p_asset_id;

  update public.container_assignments
  set asset_label = normalized_label,
      size_label = p_size_label,
      updated_at = now()
  where asset_id = new_asset_id;

  update public.container_reports
  set install_asset_label = case when install_asset_id = new_asset_id then normalized_label else install_asset_label end,
      collect_asset_label = case when collect_asset_id = new_asset_id then normalized_label else collect_asset_label end,
      size_label = case when install_asset_id = new_asset_id or collect_asset_id = new_asset_id then p_size_label else size_label end,
      updated_at = now()
  where install_asset_id = new_asset_id or collect_asset_id = new_asset_id;

  return new_asset_id;
end;
$$;

create or replace function public.set_numbered_container_active(
  p_asset_id text,
  p_active boolean
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_label text;
begin
  select label into current_label
  from public.container_assets
  where id = p_asset_id and asset_type = 'コンテナ'
  for update;

  if not found then
    raise exception '対象のコンテナ番号が見つかりません。';
  end if;

  if not p_active and exists (
    select 1 from public.container_assignments
    where asset_id = p_asset_id and collected_on is null
  ) then
    raise exception 'コンテナ番号「%」は現在設置中のため、使用停止にできません。', current_label;
  end if;

  update public.container_assets
  set is_active = p_active, updated_at = now()
  where id = p_asset_id;
end;
$$;

revoke all on function public.rename_numbered_container(text, text, text) from public;
grant execute on function public.rename_numbered_container(text, text, text) to authenticated;
revoke all on function public.set_numbered_container_active(text, boolean) from public;
grant execute on function public.set_numbered_container_active(text, boolean) to authenticated;
