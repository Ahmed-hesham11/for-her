-- ============================================================================
-- wishlists.user_id still has a leftover FK constraint pointing at the old
-- Supabase Auth `auth.users` table. 20260927020000_drop_auth_uid_policies.sql
-- was supposed to repoint it to public.profiles(id) along with carts/orders,
-- but its lookup query had the same cross-schema join bug that
-- 20260930010000_drop_profiles_auth_fk.sql later found and fixed for
-- profiles.id: it joined constraint_column_usage ON ccu.table_schema =
-- tc.table_schema (forcing 'public') while also filtering ccu.table_schema =
-- 'auth' — a contradiction that always returns zero rows. So the DROP never
-- ran, and the subsequent ADD CONSTRAINT collided with the untouched
-- original and aborted the whole DO block — before it ever reached
-- carts/orders, which is why only wishlists was left broken.
--
-- Confirmed live by inserting a test row via the service-role key: 23503
-- "wishlists_user_id_fkey ... is not present in table users".
--
-- This version finds the FK by column name only (same fix pattern as
-- 20260930010000), regardless of which table it references.
--
-- ADD CONSTRAINT validates existing rows, and since the FK pointed at
-- auth.users this whole time, deleting/truncating profiles (see
-- 20260927000000_profiles_own_schema.sql's truncate) never cascaded into
-- wishlists — confirmed live via the service-role key: 1 of 1 existing
-- wishlist rows has a user_id no longer present in profiles. These are
-- disposable saved-for-later entries (no order/financial data), so the
-- orphan is deleted rather than carried forward as dead data.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

delete from public.wishlists
  where user_id not in (select id from public.profiles);

do $$
declare
  fk_name text;
begin
  for fk_name in
    select tc.constraint_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name
       and kcu.table_schema = tc.table_schema
     where tc.table_schema = 'public'
       and tc.table_name = 'wishlists'
       and tc.constraint_type = 'FOREIGN KEY'
       and kcu.column_name = 'user_id'
  loop
    execute format('alter table public.wishlists drop constraint %I', fk_name);
  end loop;
end $$;

alter table public.wishlists
  add constraint wishlists_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
