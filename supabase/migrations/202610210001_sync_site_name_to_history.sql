-- Keep the site-name snapshot in operational records synchronized with the
-- current site master. Company-name history is intentionally left unchanged.

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

  update public.container_reports
  set site_name = updated_site.name
  where site_id = updated_site.id
    and site_name is distinct from updated_site.name;

  update public.container_assignments
  set site_name = updated_site.name,
      updated_at = now()
  where site_id = updated_site.id
    and site_name is distinct from updated_site.name;

  update public.basket_balances
  set site_name = updated_site.name,
      updated_at = now()
  where site_id = updated_site.id
    and site_name is distinct from updated_site.name;

  return to_jsonb(updated_site);
end;
$$;

revoke all on function public.update_container_site_master(uuid, text, text, text) from public;
grant execute on function public.update_container_site_master(uuid, text, text, text) to authenticated;

-- Reconcile records that were saved before site-name synchronization existed.
update public.container_reports r
set site_name = s.name
from public.container_sites s
where r.site_id = s.id
  and r.site_name is distinct from s.name;

update public.container_assignments a
set site_name = s.name,
    updated_at = now()
from public.container_sites s
where a.site_id = s.id
  and a.site_name is distinct from s.name;

update public.basket_balances b
set site_name = s.name,
    updated_at = now()
from public.container_sites s
where b.site_id = s.id
  and b.site_name is distinct from s.name;
