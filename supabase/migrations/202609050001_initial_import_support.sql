-- Support the confirmed initial installation data.
-- Run after 202609020001_customer_site_basket_management.sql.

-- Some legacy records have no reliable installation date. Keep them visible,
-- but leave the date null so they are excluded from long-term calculations.
alter table public.container_assignments
  alter column installed_on drop not null;
