-- Keep active installation data linked to the current customer master name.
-- Historical reports are intentionally left unchanged so printed history
-- continues to show the name that was in use when each report was recorded.

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
  current_display_name text;
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

  current_display_name := case
    when btrim(updated_customer.previous_name) = '' then updated_customer.name
    else updated_customer.name || '（旧社名：' || updated_customer.previous_name || '）'
  end;

  -- Current location screens and collection validation use the latest master
  -- name. Closed assignments and reports remain historical snapshots.
  update public.container_assignments
  set company_name = current_display_name
  where customer_id = p_customer_id
    and collected_on is null;

  update public.basket_balances
  set company_name = current_display_name
  where customer_id = p_customer_id;

  return to_jsonb(updated_customer);
end;
$$;

revoke all on function public.update_container_customer_master(uuid, text, text, text) from public;
grant execute on function public.update_container_customer_master(uuid, text, text, text) to authenticated;

-- Repair active rows that may already have been left under a former name.
update public.container_assignments a
set company_name = case
  when btrim(c.previous_name) = '' then c.name
  else c.name || '（旧社名：' || c.previous_name || '）'
end
from public.container_customers c
where a.customer_id = c.id
  and a.collected_on is null
  and a.company_name is distinct from case
    when btrim(c.previous_name) = '' then c.name
    else c.name || '（旧社名：' || c.previous_name || '）'
  end;

update public.basket_balances b
set company_name = case
  when btrim(c.previous_name) = '' then c.name
  else c.name || '（旧社名：' || c.previous_name || '）'
end
from public.container_customers c
where b.customer_id = c.id
  and b.company_name is distinct from case
    when btrim(c.previous_name) = '' then c.name
    else c.name || '（旧社名：' || c.previous_name || '）'
  end;
