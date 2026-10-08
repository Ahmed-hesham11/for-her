-- ============================================================================
-- Lets a product carry more than one photo. products.image_url stays exactly
-- what it always was — the cover photo used everywhere a single thumbnail is
-- shown (storefront cards/listings, admin tables, invoices, order items) —
-- and a new products.images text[] column holds any additional photos, shown
-- only on the admin product edit page's gallery section for now.
--
-- A plain array column rather than a separate product_images table: there's
-- no per-image metadata (alt text, a stored sort key beyond array order,
-- etc.) to justify a join, and the admin form only ever replaces the whole
-- list at once on save, never edits one row of it independently.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

alter table public.products add column if not exists images text[] not null default '{}';
