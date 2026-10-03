-- ============================================================================
-- PHASE 2 ONLY: profiles (own row) + carts/cart_items (own cart) access.
--
-- Scope (intentionally narrow):
--   - A signed-in user may read/insert/update only their own profiles row.
--   - A signed-in user may fully manage only their own cart (carts/cart_items).
--   - No one can change their own `role` through a normal client update.
--
-- Deliberately NOT touched here:
--   - products/categories policies from Phase 1 (untouched — this migration
--     adds no policy or grant on either table).
--   - orders / order_items / suppliers / purchases / purchase_items / coupons
--     — no grants or policies here at all. Checkout/orders remain exactly as
--     functional (or not) as they are today; that's Phase 3.
--   - No is_admin() helper, no admin bypass, no aggregate/reporting functions.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor
-- when you approve it. No service-role key involved; runs under your own
-- session.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

-- ----------------------------------------------------------------------------
-- Profiles: a signed-in user may read/insert/update only their own row.
-- ----------------------------------------------------------------------------
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Block role changes coming from a normal API/client update. auth.uid() is
-- only set on requests carrying a Supabase Auth JWT (anon/authenticated
-- calls through PostgREST); a direct SQL editor session has no such JWT, so
-- auth.uid() is null there and a manual admin-promotion UPDATE still works
-- without needing any admin logic yet.
create or replace function public.prevent_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception using errcode = 'P0001', message = 'ROLE_CHANGE_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_self_change on public.profiles;
create trigger trg_prevent_role_self_change
  before update on public.profiles
  for each row execute function public.prevent_role_self_change();

-- ----------------------------------------------------------------------------
-- Carts & cart_items: a signed-in user may fully manage only their own cart.
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on public.carts, public.cart_items to authenticated;

drop policy if exists "carts_own" on public.carts;
create policy "carts_own" on public.carts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "cart_items_own" on public.cart_items;
create policy "cart_items_own" on public.cart_items
  for all using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));
