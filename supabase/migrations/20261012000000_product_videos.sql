-- ============================================================================
-- Lets a product carry videos alongside its photos. products.videos is a text[]
-- of public URLs (same shape as products.images from
-- 20261008020000_product_gallery_images.sql), shown in the storefront product
-- page's media gallery and editable from the admin product form.
--
-- Videos are stored in the same public "catalog-images" bucket (products/
-- folder). They're uploaded straight from the browser to Storage through a
-- signed upload URL minted by an admin-only server action, so they never pass
-- through a Next.js request body (which is size-capped). The bucket has no
-- per-file limit of its own; Supabase's project-wide upload limit applies
-- (50MB on the free plan) and the admin form enforces the same 50MB ceiling.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

alter table public.products add column if not exists videos text[] not null default '{}';
