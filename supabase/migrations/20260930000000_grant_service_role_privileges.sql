-- ============================================================================
-- service_role has no table-level GRANTs on the public schema at all (every
-- table returns 42501 "permission denied for table X" via the REST API,
-- confirmed with the sb_secret_* key against profiles/products/orders).
-- RLS bypass and table GRANTs are separate mechanisms — service_role
-- bypassing RLS does not imply it holds SELECT/INSERT/UPDATE/DELETE grants.
-- Every server route in lib/supabase/admin.ts depends on service_role
-- having full table access, so registration/login/checkout/admin all fail
-- with generic 500s until this is applied.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Cover tables/sequences created after this migration runs too.
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
alter default privileges in schema public grant all privileges on functions to service_role;
