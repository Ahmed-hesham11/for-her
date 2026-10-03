-- ============================================================================
-- FIX: admin_top_selling_products() returns duplicate rows for the same
-- product_id, which crashes the admin dashboard's TopProductsTable with a
-- "two children with the same key" error.
--
-- Root cause: order_items.product_name/sku are a per-order snapshot (set
-- once at checkout in create_secure_order — see 20260903190000), by design,
-- so historical orders don't change if a product is renamed later. The
-- original function grouped by (product_id, product_name, sku) instead of
-- product_id alone, so a product whose name or SKU was ever edited after it
-- had orders produces two differing snapshots and therefore two rows here,
-- both sharing the same product_id.
--
-- Fix: aggregate units_sold/revenue by product_id only, then attach the most
-- recent product_name/sku snapshot (by order date) for display — one row
-- per product, as the table already assumes.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor
-- when you approve it. No service-role key involved; runs under your own
-- session.
-- ============================================================================

create or replace function public.admin_top_selling_products(limit_count integer default 5)
returns table(product_id uuid, product_name text, sku text, units_sold bigint, revenue numeric)
language sql
security definer
set search_path = public
as $$
  with agg as (
    select oi.product_id, sum(oi.quantity)::bigint as units_sold, sum(oi.total_price) as revenue
    from order_items oi
    join orders o on o.id = oi.order_id
    where public.is_admin() and o.status <> 'cancelled'
    group by oi.product_id
  ),
  latest_snapshot as (
    select distinct on (oi.product_id) oi.product_id, oi.product_name, oi.sku
    from order_items oi
    join orders o on o.id = oi.order_id
    where public.is_admin() and o.status <> 'cancelled'
    order by oi.product_id, o.created_at desc
  )
  select a.product_id, s.product_name, s.sku, a.units_sold, a.revenue
  from agg a
  join latest_snapshot s on s.product_id = a.product_id
  order by a.units_sold desc
  limit greatest(limit_count, 1);
$$;
