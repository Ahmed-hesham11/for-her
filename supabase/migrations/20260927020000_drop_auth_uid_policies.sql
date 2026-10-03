-- ============================================================================
-- Remove every RLS policy, function, and trigger that depends on
-- auth.uid()/auth.users, and repoint the FKs that pointed at auth.users(id)
-- to public.profiles(id) instead.
--
-- Ownership checks (profiles/carts/cart_items/orders/order_items/wishlists)
-- move from RLS into trusted Next.js server code, which is the only thing
-- that talks to these tables from now on via the service-role key. RLS
-- stays ENABLED on all of them — dropping these policies leaves NO policy
-- for anon/authenticated, i.e. zero access, not "RLS disabled".
--
-- Public read-only policies (products/categories/shipping_rates 'is_active',
-- catalog-images public read) never used auth.uid() and are untouched here.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Repoint FKs: auth.users(id) -> public.profiles(id)
--
-- Fully idempotent (safe to re-run): drops any FK on the column that
-- points at auth.users, then only adds the profiles FK if the column
-- doesn't already have one pointing at profiles. Re-running this after a
-- partial failure (e.g. a later statement in this file errored) won't hit
-- "constraint already exists".
-- ----------------------------------------------------------------------------
do $$
declare
  fk_name text;
  targets record;
  already_pointing_at_profiles boolean;
begin
  for targets in
    select * from (values
      ('wishlists', 'user_id', 'wishlists_user_id_fkey', 'cascade'),
      ('carts', 'user_id', 'carts_user_id_fkey', 'cascade'),
      ('orders', 'user_id', 'orders_user_id_fkey', 'set null')
    ) as t(table_name, column_name, constraint_name, on_delete)
  loop
    -- Drop an existing FK on this column that still points at auth.users.
    select tc.constraint_name into fk_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.table_schema = 'public' and tc.table_name = targets.table_name
        and kcu.column_name = targets.column_name
        and tc.constraint_type = 'FOREIGN KEY'
        and ccu.table_schema = 'auth' and ccu.table_name = 'users'
      limit 1;
    if fk_name is not null then
      execute format('alter table public.%I drop constraint %I', targets.table_name, fk_name);
    end if;

    -- Already repointed at profiles (e.g. a prior partial run) — skip.
    select exists (
      select 1
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
        where tc.table_schema = 'public' and tc.table_name = targets.table_name
          and kcu.column_name = targets.column_name
          and tc.constraint_type = 'FOREIGN KEY'
          and ccu.table_schema = 'public' and ccu.table_name = 'profiles'
    ) into already_pointing_at_profiles;

    if not already_pointing_at_profiles then
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete %s',
        targets.table_name, targets.constraint_name, targets.column_name, targets.on_delete
      );
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Drop auth.uid()-keyed "own row" policies
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_read_all" on public.profiles;

drop policy if exists "carts_own" on public.carts;
drop policy if exists "cart_items_own" on public.cart_items;

drop policy if exists "orders_own_read" on public.orders;
drop policy if exists "order_items_own_read" on public.order_items;

drop policy if exists "wishlists_own" on public.wishlists;

-- ----------------------------------------------------------------------------
-- Drop is_admin()-keyed admin policies (direct table access from the
-- browser is no longer how admin writes happen — see the app-layer changes)
-- ----------------------------------------------------------------------------
drop policy if exists "products_admin_all" on public.products;
drop policy if exists "categories_admin_all" on public.categories;
drop policy if exists "orders_admin_all" on public.orders;
drop policy if exists "order_items_admin_read" on public.order_items;
drop policy if exists "suppliers_admin_all" on public.suppliers;
drop policy if exists "purchases_admin_all" on public.purchases;
drop policy if exists "purchase_items_admin_all" on public.purchase_items;
drop policy if exists "coupons_admin_all" on public.coupons;
drop policy if exists "shipping_rates_admin_all" on public.shipping_rates;

drop policy if exists "catalog_images_admin_insert" on storage.objects;
drop policy if exists "catalog_images_admin_update" on storage.objects;
drop policy if exists "catalog_images_admin_delete" on storage.objects;

-- Revoke the old client-role grants that let these tables be written to
-- directly over PostgREST at all — writes now happen exclusively through
-- the service-role key from trusted Next.js server code.
revoke all on public.profiles from anon, authenticated;
revoke all on public.carts, public.cart_items from anon, authenticated;
revoke all on public.orders, public.order_items from anon, authenticated;
revoke all on public.wishlists from anon, authenticated;
revoke all on public.suppliers, public.purchases, public.purchase_items, public.coupons from anon, authenticated;
-- shipping_rates keeps its public SELECT grant (shipping_rates_public_read
-- policy, untouched) — only revoke the admin write grant.
revoke insert, update, delete on public.shipping_rates from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Role-change protection moves to the app layer (there's no more
-- auth.uid()-is-null signal to distinguish "API call" from "SQL editor" —
-- the new Next.js account/admin routes simply never forward a client-
-- supplied `role` value into an update).
-- ----------------------------------------------------------------------------
drop trigger if exists trg_prevent_role_self_change on public.profiles;
drop function if exists public.prevent_role_self_change();
