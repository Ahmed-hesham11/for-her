-- ============================================================================
-- Add Best Seller columns to products.
--
-- Confirmed via information_schema.columns (the schema dump run earlier in
-- this project) that no equivalent column already exists — no
-- is_best_seller, featured, bestseller, best_seller_order, or display_order.
-- This is a pure additive schema change: two new nullable-safe columns,
-- nothing dropped, nothing renamed, no existing data touched.
--
-- No RLS/grant changes are needed. Row-level security and GRANTs in this
-- project are row/table-scoped, not column-scoped:
--   - `products_public_read` (storefront) already permits SELECT on any
--     active product row, which will include these new columns automatically.
--   - `products_admin_all` (admin) already permits full INSERT/UPDATE/DELETE
--     for admins only, which will cover these new columns automatically.
--   - No policy grants UPDATE on products to non-admin authenticated users
--     at all, so a normal customer cannot write to these columns (or any
--     other product column) either before or after this migration.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

alter table public.products
  add column if not exists is_best_seller boolean not null default false,
  add column if not exists best_seller_order integer;
