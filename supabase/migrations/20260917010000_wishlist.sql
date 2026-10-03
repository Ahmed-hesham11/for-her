-- ============================================================================
-- WISHLIST: creates the wishlists table — it doesn't exist yet. The heart
-- buttons on the product card, product detail page, and header have never
-- been wired to anything (confirmed by direct inspection: no click handler,
-- no query, no table). This migration adds the table and locks it down with
-- RLS, same shape as Phase 2's carts/cart_items.
--
-- Scope (intentionally narrow):
--   - A signed-in user may select/insert/delete only their own wishlist rows.
--   - One row per (user_id, product_id) — a unique constraint prevents
--     duplicate wishlist entries at the database level, not just in the UI.
--   - No update policy: a wishlist row is either present or absent, so
--     updates are never needed.
--   - Deleting a product cascades its wishlist rows; deleting a user
--     cascades theirs. No other table is touched.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor
-- when you approve it. No service-role key involved; runs under your own
-- session.
-- ============================================================================

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists wishlists_user_id_idx on public.wishlists (user_id);

alter table public.wishlists enable row level security;

grant select, insert, delete on public.wishlists to authenticated;

drop policy if exists "wishlists_own" on public.wishlists;
create policy "wishlists_own" on public.wishlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
