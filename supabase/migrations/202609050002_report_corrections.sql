-- Searchable report corrections with an audit trail and full state rebuild.
-- Run after 202609050001_initial_import_support.sql.

begin;

create table if not exists public.container_report_corrections (
  id uuid primary key default gen_random_uuid(),
  report_id text not null references public.container_reports(id) on update cascade on delete restrict,
  corrected_by uuid not null default auth.uid(),
  before_data jsonb not null,
  after_data jsonb not null,
  corrected_at timestamptz not null default now()
);

create index if not exists container_report_corrections_report_idx
  on public.container_report_corrections (report_id, corrected_at desc);

alter table public.container_report_corrections enable row level security;

drop policy if exists "authenticated users read report corrections" on public.container_report_corrections;
create policy "authenticated users read report corrections"
on public.container_report_corrections
for select to authenticated
using (true);

drop policy if exists "authenticated users insert report corrections" on public.container_report_corrections;
create policy "authenticated users insert report corrections"
on public.container_report_corrections
for insert to authenticated
with check (corrected_by = auth.uid());

revoke all on table public.container_report_corrections from anon;
grant select, insert on table public.container_report_corrections to authenticated;

-- The initial import intentionally permits an unknown installation date. Such
-- an assignment is still the start-of-day assignment for a later collection.
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

    delete from public.container_assignments a
      where a.asset_id = target_asset_id
        and a.source_report_id in (
          select r.id from public.container_reports r
          where r.work_date = p_work_date and r.install_asset_id = target_asset_id
        );

    select count(*) into install_count
      from public.container_reports r
      where r.work_date = p_work_date and r.install_asset_id = target_asset_id;

    select count(*) into collect_count
      from public.container_reports r
      where r.work_date = p_work_date and r.collect_asset_id = target_asset_id;

    install_report := null;
    select r.* into install_report
      from public.container_reports r
      where r.work_date = p_work_date and r.install_asset_id = target_asset_id
      order by r.entry_order desc, r.created_at desc
      limit 1;

    prior_assignment := null;
    select a.* into prior_assignment
      from public.container_assignments a
      where a.asset_id = target_asset_id
        and (a.installed_on is null or a.installed_on <= p_work_date)
        and (a.collected_on is null or a.collected_on >= p_work_date)
      order by a.installed_on desc nulls last, a.created_at desc
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

create or replace function public.rebuild_container_asset(p_asset_id text)
returns text[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  report_date date;
  result_row record;
  warnings text[] := array[]::text[];
  baseline_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('rebuild:' || p_asset_id, 0));

  select count(*) into baseline_count
    from public.container_assignments
    where asset_id = p_asset_id and source_report_id is null;

  if baseline_count > 1 then
    raise exception 'コンテナ%には初期設置データが複数あるため、自動訂正できません。', replace(p_asset_id, 'container-', '');
  end if;

  delete from public.container_assignments
    where asset_id = p_asset_id and source_report_id is not null;

  update public.container_assignments
    set collected_on = null
    where asset_id = p_asset_id and source_report_id is null;

  for report_date in
    select distinct r.work_date
    from public.container_reports r
    where r.id not like 'initial-report-%'
      and (r.install_asset_id = p_asset_id or r.collect_asset_id = p_asset_id)
    order by r.work_date
  loop
    for result_row in
      select * from public.reconcile_container_day(report_date, array[p_asset_id])
    loop
      if result_row.status <> '反映済み' then
        warnings := array_append(
          warnings,
          replace(p_asset_id, 'container-', '') || '（' || report_date::text || '）：' || result_row.status
        );
      end if;
    end loop;
  end loop;

  return warnings;
end;
$$;

grant execute on function public.rebuild_container_asset(text) to authenticated;

create or replace function public.rebuild_basket_balance(
  p_customer_id uuid,
  p_site_id uuid,
  p_basket_type text
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
    'basket:' || p_customer_id::text || ':' || p_site_id::text || ':' || p_basket_type,
    0
  ));

  select c.name, s.name
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
    where r.asset_type = 'カゴ'
      and r.customer_id = p_customer_id
      and r.site_id = p_site_id
      and r.size_label = p_basket_type;

  if next_quantity < 0 then
    raise exception '訂正後のカゴ設置台数が0未満になるため保存できません。';
  end if;

  if next_quantity = 0 then
    delete from public.basket_balances
      where customer_id = p_customer_id and site_id = p_site_id and basket_type = p_basket_type;
  else
    insert into public.basket_balances (
      customer_id, site_id, company_name, site_name, basket_type, quantity
    ) values (
      p_customer_id, p_site_id, canonical_company_name, canonical_site_name, p_basket_type, next_quantity
    )
    on conflict (customer_id, site_id, basket_type) do update
      set company_name = excluded.company_name,
          site_name = excluded.site_name,
          quantity = excluded.quantity,
          updated_at = now();
  end if;

  return next_quantity;
end;
$$;

grant execute on function public.rebuild_basket_balance(uuid, uuid, text) to authenticated;

create or replace function public.correct_container_report(
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
  p_basket_install_count integer,
  p_basket_collect_count integer,
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

  select * into old_report
    from public.container_reports
    where id = p_report_id
    for update;

  if old_report.id is null then
    raise exception '訂正対象の入力履歴が見つかりません。';
  end if;

  if p_work_date is null or btrim(p_driver_name) = '' then
    raise exception '日付とドライバー名を入力してください。';
  end if;

  select c.name, s.name
    into canonical_company_name, canonical_site_name
    from public.container_customers c
    join public.container_sites s on s.customer_id = c.id
    where c.id = p_customer_id and s.id = p_site_id;

  if canonical_company_name is null then
    raise exception '排出事業者と現場の組み合わせが正しくありません。';
  end if;

  if old_report.asset_type = 'カゴ' then
    if p_basket_install_count < 0 or p_basket_collect_count < 0 then
      raise exception 'カゴの台数には0以上の数を指定してください。';
    end if;
    if p_basket_install_count = 0 and p_basket_collect_count = 0 then
      raise exception 'カゴの設置または引上げ台数を入力してください。';
    end if;
    if btrim(p_size_label) = '' then
      raise exception 'カゴ等の種類を入力してください。';
    end if;

    next_asset_type := 'カゴ';
    next_size_label := btrim(p_size_label);
    next_work_type := case
      when p_basket_install_count > 0 and p_basket_collect_count > 0 then '交換'
      when p_basket_install_count > 0 then '設置'
      when p_basket_collect_count > 0 then '回収'
      else '手積み'
    end;
  else
    if p_install_asset_id is not null and p_install_asset_id = p_collect_asset_id then
      raise exception '設置と引上げには別のコンテナ番号を指定してください。';
    end if;
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

  -- The canonical master names are used even if stale display text was posted.
  update public.container_reports
    set work_date = p_work_date,
        customer_id = p_customer_id,
        company_name = canonical_company_name,
        site_id = p_site_id,
        site_name = canonical_site_name,
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
        basket_install_count = case when next_asset_type = 'カゴ' then p_basket_install_count else 0 end,
        basket_collect_count = case when next_asset_type = 'カゴ' then p_basket_collect_count else 0 end
    where id = p_report_id
    returning * into new_report;

  insert into public.container_report_corrections (
    report_id, corrected_by, before_data, after_data
  ) values (
    p_report_id, auth.uid(), to_jsonb(old_report), to_jsonb(new_report)
  );

  if old_report.asset_type <> 'カゴ' then
    for target_asset_id in
      select distinct value
      from unnest(array[
        old_report.install_asset_id,
        old_report.collect_asset_id,
        new_report.install_asset_id,
        new_report.collect_asset_id
      ]) as affected(value)
      where value is not null
    loop
      asset_warnings := public.rebuild_container_asset(target_asset_id);
      warnings := warnings || coalesce(asset_warnings, array[]::text[]);
    end loop;
  end if;

  if old_report.asset_type = 'カゴ' then
    perform public.rebuild_basket_balance(old_report.customer_id, old_report.site_id, old_report.size_label);
    if row(old_report.customer_id, old_report.site_id, old_report.size_label)
      is distinct from row(new_report.customer_id, new_report.site_id, new_report.size_label) then
      perform public.rebuild_basket_balance(new_report.customer_id, new_report.site_id, new_report.size_label);
    end if;
  end if;

  return jsonb_build_object('warnings', to_jsonb(warnings));
end;
$$;

revoke all on function public.correct_container_report(
  text, date, uuid, uuid, text, text, text, text, text, text, text, integer, integer, text
) from public;
grant execute on function public.correct_container_report(
  text, date, uuid, uuid, text, text, text, text, text, text, text, integer, integer, text
) to authenticated;

commit;
