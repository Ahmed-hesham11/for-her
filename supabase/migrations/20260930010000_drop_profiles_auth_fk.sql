-- ============================================================================
-- profiles.id still has a leftover FK constraint pointing at the old
-- Supabase Auth `users` table (confirmed by inserting a test row via the
-- REST API: 23503 "profiles_id_fkey ... is not present in table users").
-- The DO block in 20260927000000_profiles_own_schema.sql was supposed to
-- find and drop it, but it only searched constraint_column_usage joined on
-- auth.users specifically; this version searches by the referencing column
-- (profiles.id) directly, so it will catch the constraint regardless of
-- which table/schema it points at.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

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
       and tc.table_name = 'profiles'
       and tc.constraint_type = 'FOREIGN KEY'
       and kcu.column_name = 'id'
  loop
    execute format('alter table public.profiles drop constraint %I', fk_name);
  end loop;
end $$;

-- profiles.id must generate its own UUID now that it's not populated by an
-- auth.users row via trigger.
alter table public.profiles
  alter column id set default gen_random_uuid();
