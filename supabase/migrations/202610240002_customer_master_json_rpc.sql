-- Return the customer master as one JSON value so PostgREST's per-response
-- row cap cannot truncate kana-search candidates.

create or replace function public.list_container_customers_json()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'customer_code', c.customer_code,
        'name', c.name,
        'name_kana', c.name_kana,
        'previous_name', c.previous_name
      )
      order by c.customer_code
    ),
    '[]'::jsonb
  )
  from public.container_customers c;
$$;

revoke all on function public.list_container_customers_json() from public;
grant execute on function public.list_container_customers_json() to authenticated;

select jsonb_array_length(public.list_container_customers_json()) as "取得できる排出事業者件数";
