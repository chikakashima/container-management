-- Allow authenticated users to delete an unused site master safely.
-- Sites referenced by reports, current assignments, or quantity balances are preserved.

create or replace function public.delete_container_site_master(p_site_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_site public.container_sites%rowtype;
begin
  select * into target_site
  from public.container_sites
  where id = p_site_id
  for update;

  if target_site.id is null then
    raise exception '現場が見つかりません。';
  end if;

  if exists (
    select 1 from public.container_reports where site_id = p_site_id
  ) then
    raise exception 'この現場には入力履歴があります。過去の帳票を保持するため削除できません。';
  end if;

  if exists (
    select 1 from public.container_assignments where site_id = p_site_id
  ) then
    raise exception 'この現場には現在設置中のコンテナがあります。引上げ後も履歴が残るため削除できません。';
  end if;

  if exists (
    select 1 from public.basket_balances where site_id = p_site_id
  ) then
    raise exception 'この現場にはカゴ・貸出備品の台数情報があります。履歴を保持するため削除できません。';
  end if;

  delete from public.container_sites where id = p_site_id;

  return jsonb_build_object(
    'id', target_site.id,
    'site_code', target_site.site_code,
    'name', target_site.name
  );
end;
$$;

revoke all on function public.delete_container_site_master(uuid) from public;
grant execute on function public.delete_container_site_master(uuid) to authenticated;
