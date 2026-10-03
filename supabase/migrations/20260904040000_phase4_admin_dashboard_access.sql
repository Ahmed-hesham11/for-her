-- ============================================================================
-- PHASE 4: admin dashboard access (products/categories write, profiles
-- read-all, orders/order_items read-all, and the reporting functions the
-- admin dashboard home page calls).
--
-- Role model: "admin" and "super_admin" currently carry IDENTICAL dashboard
-- permissions — super_admin is an org-chart label for now, not a distinct
-- permission tier. is_admin() treats both as admin.
--
-- Deliberately NOT included here (out of scope until those modules are
-- actually built):
--   - suppliers / purchases / purchase_items / coupons — no policy or grant
--     on any of them. Nothing in the app queries these tables yet (their
--     admin pages are still "coming soon" placeholders).
--   - No customer-facing orders policy (own-order read/insert) — that's
--     Phase 3, not yet approved/run.
--   - No ability for admin to change another user's role from the app —
--     role promotion stays a manual SQL Editor operation (see Phase 2's
--     prevent_role_self_change trigger, unchanged).
--
-- Prerequisites: Phase 1 (products/categories public read) and Phase 2
-- (profiles/carts own-row access) must already be applied — this migration
-- only adds to them, it doesn't redefine anything from those files.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor
-- when ready. No service-role key involved; runs under your own session.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. is_admin() — SECURITY DEFINER so it can read profiles.role regardless of
--    the caller's own row-level access, and to avoid the "RLS policy on
--    profiles queries profiles" recursion problem.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Profiles: admin may additionally read every row (needed for the
--    customer count and, later, the Customers list). This is additive to
--    Phase 2's "own row only" policy — permissive policies OR together.
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_admin_read_all" on public.profiles;
create policy "profiles_admin_read_all" on public.profiles
  for select using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. Products & categories: admin may see inactive rows too and may write.
--    Additive to Phase 1's "public read of active rows" policy.
-- ----------------------------------------------------------------------------
grant insert, update, delete on public.products, public.categories to authenticated;

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. Orders & order_items: enable RLS, admin-only for now (no customer
--    "own order" policy yet — that's Phase 3, not part of this migration).
--    Admin gets read + update (for order status / payment status changes).
-- ----------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items_admin_read" on public.order_items;
create policy "order_items_admin_read" on public.order_items
  for select using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. Admin dashboard aggregate functions (SECURITY DEFINER + explicit
--    is_admin() check so they work regardless of table-level RLS and are
--    unusable by non-admins).
-- ----------------------------------------------------------------------------
create or replace function public.admin_revenue_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_ONLY';
  end if;

  return jsonb_build_object(
    'today', coalesce((select sum(total_amount) from orders where status <> 'cancelled' and created_at >= date_trunc('day', now())), 0),
    'last_7_days', coalesce((select sum(total_amount) from orders where status <> 'cancelled' and created_at >= now() - interval '7 days'), 0),
    'last_30_days', coalesce((select sum(total_amount) from orders where status <> 'cancelled' and created_at >= now() - interval '30 days'), 0)
  );
end;
$$;

create or replace function public.admin_revenue_by_day(days_back integer default 14)
returns table(day date, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select d::date as day, coalesce(sum(o.total_amount), 0) as revenue
  from generate_series(current_date - (greatest(days_back, 1) - 1), current_date, interval '1 day') d
  left join orders o on o.created_at::date = d::date and o.status <> 'cancelled'
  where public.is_admin()
  group by d
  order by d;
$$;

create or replace function public.admin_order_status_counts()
returns table(status text, count bigint)
language sql
security definer
set search_path = public
as $$
  select status, count(*)
  from orders
  where public.is_admin()
  group by status;
$$;

create or replace function public.admin_top_selling_products(limit_count integer default 5)
returns table(product_id uuid, product_name text, sku text, units_sold bigint, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select oi.product_id, oi.product_name, oi.sku, sum(oi.quantity)::bigint as units_sold, sum(oi.total_price) as revenue
  from order_items oi
  join orders o on o.id = oi.order_id
  where public.is_admin() and o.status <> 'cancelled'
  group by oi.product_id, oi.product_name, oi.sku
  order by units_sold desc
  limit greatest(limit_count, 1);
$$;

create or replace function public.admin_stock_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_ONLY';
  end if;

  return jsonb_build_object(
    'total', (select count(*) from products),
    'active', (select count(*) from products where is_active),
    'out_of_stock', (select count(*) from products where stock_quantity <= 0),
    'low_stock', (select count(*) from products where stock_quantity > 0 and stock_quantity <= minimum_stock)
  );
end;
$$;

create or replace function public.admin_low_stock_products(limit_count integer default 20)
returns table(id uuid, name text, sku text, stock_quantity integer, minimum_stock integer)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.sku, p.stock_quantity, p.minimum_stock
  from products p
  where public.is_admin() and p.stock_quantity <= p.minimum_stock
  order by p.stock_quantity asc
  limit greatest(limit_count, 1);
$$;

revoke all on function public.admin_revenue_summary() from public;
revoke all on function public.admin_revenue_by_day(integer) from public;
revoke all on function public.admin_order_status_counts() from public;
revoke all on function public.admin_top_selling_products(integer) from public;
revoke all on function public.admin_stock_summary() from public;
revoke all on function public.admin_low_stock_products(integer) from public;
grant execute on function public.admin_revenue_summary() to authenticated;
grant execute on function public.admin_revenue_by_day(integer) to authenticated;
grant execute on function public.admin_order_status_counts() to authenticated;
grant execute on function public.admin_top_selling_products(integer) to authenticated;
grant execute on function public.admin_stock_summary() to authenticated;
grant execute on function public.admin_low_stock_products(integer) to authenticated;
