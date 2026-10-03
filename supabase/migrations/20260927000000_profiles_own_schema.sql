-- ============================================================================
-- Remove Supabase Auth as the identity system. `public.profiles` becomes a
-- fully self-contained customer/account table — its own email + password
-- hash — instead of a 1:1 shadow of `auth.users`.
--
-- Confirmed with the project owner: every row currently in `profiles` /
-- `auth.users` is test/dev data, not real customers, so this migration
-- TRUNCATEs `profiles` rather than attempting to invent emails/passwords
-- for existing rows (which is cryptographically impossible for passwords
-- anyway — Supabase Auth's password hash cannot be converted to an
-- Argon2id hash without the plaintext). `auth.users` itself is left
-- completely untouched — it simply becomes unused by the application.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

-- profiles.id was `references auth.users(id) on delete cascade` (the
-- standard Supabase pattern) even though that constraint's DDL was never
-- checked into a migration file. Find and drop it by inspecting the actual
-- constraint instead of guessing its name.
do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'profiles'
      and tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_schema = 'auth'
      and ccu.table_name = 'users'
    limit 1;

  if fk_name is not null then
    execute format('alter table public.profiles drop constraint %I', fk_name);
  end if;
end $$;

-- Wipe test/dev rows before adding NOT NULL/UNIQUE constraints below —
-- there is no real customer data to preserve (see comment above). CASCADE
-- is required because carts/cart_items/orders/order_items/wishlists all
-- reference profiles — confirmed with the project owner that those rows
-- are test data too and clearing them alongside profiles is expected.
truncate table public.profiles cascade;

alter table public.profiles
  alter column id set default gen_random_uuid(),
  add column if not exists email text,
  add column if not exists password_hash text,
  add column if not exists city text,
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  alter column email set not null,
  alter column password_hash set not null;

alter table public.profiles
  add constraint profiles_email_key unique (email);

alter table public.profiles
  alter column role set default 'customer';
