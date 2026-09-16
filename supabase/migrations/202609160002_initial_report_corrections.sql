-- Allow authenticated users to correct initial-import master details while
-- preserving the imported asset identity and quantity movement.

create or replace function public.correct_initial_container_report(
  p_report_id text,
  p_work_date date,
  p_customer_id uuid,
  p_site_id uuid,
  p_driver_name text,
  p_quantity text,
  p_note text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_report public.container_reports%rowtype;
  new_report public.container_reports%rowtype;
  canonical_company_name text;
  canonical_site_name text;
begin
  if p_report_id not like 'initial-report-%' then
    raise exception '初期登録データではありません。';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('report:' || p_report_id, 0));

  select * into old_report
  from public.container_reports
  where id = p_report_id
  for update;

  if old_report.id is null then
    raise exception '訂正対象の初期登録データが見つかりません。';
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

  update public.container_reports
  set work_date = p_work_date,
      customer_id = p_customer_id,
      company_name = canonical_company_name,
      site_id = p_site_id,
      site_name = canonical_site_name,
      driver_name = btrim(p_driver_name),
      quantity = coalesce(p_quantity, ''),
      note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_report_id
  returning * into new_report;

  insert into public.container_report_corrections (
    report_id, original_report_id, corrected_by, before_data, after_data
  ) values (
    p_report_id, p_report_id, auth.uid(), to_jsonb(old_report), to_jsonb(new_report)
  );

  if old_report.asset_type in ('カゴ', '貸出備品') then
    perform public.rebuild_quantity_balance(
      old_report.customer_id, old_report.site_id, old_report.asset_type, old_report.size_label
    );
    if row(old_report.customer_id, old_report.site_id, old_report.asset_type, old_report.size_label)
      is distinct from row(new_report.customer_id, new_report.site_id, new_report.asset_type, new_report.size_label) then
      perform public.rebuild_quantity_balance(
        new_report.customer_id, new_report.site_id, new_report.asset_type, new_report.size_label
      );
    end if;
  elsif old_report.install_asset_id is not null then
    update public.container_assignments
    set customer_id = p_customer_id,
        company_name = canonical_company_name,
        site_id = p_site_id,
        site_name = canonical_site_name,
        -- Keep imported "installation date unknown" records excluded from
        -- long-term calculations when correcting another field.
        installed_on = case when installed_on is null then null else p_work_date end,
        quantity = coalesce(p_quantity, ''),
        note = nullif(btrim(coalesce(p_note, '')), '')
    where asset_id = old_report.install_asset_id
      and source_report_id is null;
  end if;

  return jsonb_build_object('corrected', true);
end;
$$;

revoke all on function public.correct_initial_container_report(
  text, date, uuid, uuid, text, text, text
) from public;
grant execute on function public.correct_initial_container_report(
  text, date, uuid, uuid, text, text, text
) to authenticated;
