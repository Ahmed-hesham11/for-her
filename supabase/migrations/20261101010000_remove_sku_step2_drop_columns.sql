-- ============================================================================
-- Remove SKU, step 2 of 2 (DESTRUCTIVE): drops products.sku and order_items.sku.
--
-- Run ONLY after:
--   * 20261101000000_remove_sku_step1_backup_and_rewrite.sql has run, and
--   * the app version without SKU is deployed and checked.
-- Aborts if the step 1 backups are missing or don't match the live data, so
-- the values can always be restored with 20261101020000_remove_sku_rollback.sql.
-- supplier_products.supplier_sku is a different thing (a supplier's own code)
-- and is intentionally NOT touched.
-- ============================================================================

do $$
begin
  if to_regclass('public.sku_backup_products') is null or to_regclass('public.sku_backup_order_items') is null then
    raise exception 'SKU backup tables are missing - run step 1 first';
  end if;
  if (select count(*) from public.sku_backup_products) < (select count(*) from public.products)
     or (select count(*) from public.sku_backup_order_items) < (select count(*) from public.order_items) then
    raise exception 'SKU backups are older than the live data - drop the stale backup tables and re-run step 1, then retry';
  end if;
end $$;

alter table public.products drop column if exists sku;
alter table public.order_items drop column if exists sku;
