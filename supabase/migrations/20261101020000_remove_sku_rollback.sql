-- ============================================================================
-- ROLLBACK for the SKU removal (steps 1 and 2). Not part of the normal flow:
-- run only to undo it. Restores products.sku and order_items.sku from the
-- backup tables created in step 1.
--
-- The functions rewritten in step 1 keep working without the columns, so
-- restoring the columns is enough to put the data back; to also restore the old
-- function bodies, re-run the earlier migrations that define them
-- (20261014010000, 20261015000000, 20261008050000, 20260917020000, 20260924010000).
-- The UNIQUE constraint dropped in step 1 is not re-added (re-add it by hand
-- only if you need it; it would fail if duplicate SKUs exist).
-- ============================================================================

alter table public.products add column if not exists sku text;
alter table public.order_items add column if not exists sku text;

update public.products p set sku = b.sku
  from public.sku_backup_products b
 where b.product_id = p.id and p.sku is distinct from b.sku;

update public.order_items oi set sku = b.sku
  from public.sku_backup_order_items b
 where b.order_item_id = oi.id and oi.sku is distinct from b.sku;
