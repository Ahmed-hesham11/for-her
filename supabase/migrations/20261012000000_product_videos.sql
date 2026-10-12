-- ============================================================================
-- Lets a product carry videos alongside its photos. products.videos is a text[]
-- of public URLs (same shape as products.images from
-- 20261008020000_product_gallery_images.sql), shown in the storefront product
-- page's media gallery and editable from the admin product form.
--
-- Only the URL list lives in the database. The video/image files themselves
-- are stored on the web server's disk (UPLOAD_DIR) and served from /uploads —
-- not in Supabase Storage.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

alter table public.products add column if not exists videos text[] not null default '{}';
