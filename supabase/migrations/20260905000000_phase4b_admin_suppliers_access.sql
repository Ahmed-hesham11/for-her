-- ============================================================================
-- PHASE 4b: admin access to `suppliers`.
--
-- Needed now because the admin Products form has a supplier dropdown, and
-- no prior migration touched `suppliers` at all (Phase 4 explicitly deferred
-- it — "nothing in the app queries these tables yet"). That's no longer
-- true: the product form needs to read it, so this grants admin full access
-- now rather than a read-only stopgap that would need revisiting the moment
-- a Suppliers admin page is built. Mirrors the products_admin_all pattern.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

alter table public.suppliers enable row level security;

grant select, insert, update, delete on public.suppliers to authenticated;

drop policy if exists "suppliers_admin_all" on public.suppliers;
create policy "suppliers_admin_all" on public.suppliers
  for all using (public.is_admin()) with check (public.is_admin());

