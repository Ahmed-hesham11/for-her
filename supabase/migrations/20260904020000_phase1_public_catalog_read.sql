-- ============================================================================
-- PHASE 1 ONLY: public read access to active products & categories.
--
-- Scope (intentionally narrow — this is only what Phase 1 needs):
--   - anon and authenticated can SELECT categories/products where is_active.
--   - Nothing else. No profiles, no carts, no orders, no admin logic.
--
-- Why this is needed: RLS is currently disabled on every table, and neither
-- `anon` nor `authenticated` holds any grant on `products`/`categories` —
-- confirmed by direct inspection. Right now every storefront product/category
-- read fails with "permission denied for table products/categories", which
-- is why /products and /categories currently render empty.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor
-- when you approve it. No service-role key involved.
-- ============================================================================

alter table public.categories enable row level security;
alter table public.products enable row level security;

grant select on public.categories, public.products to anon, authenticated;

create policy "categories_public_read" on public.categories
  for select using (is_active);

create policy "products_public_read" on public.products
  for select using (is_active);
