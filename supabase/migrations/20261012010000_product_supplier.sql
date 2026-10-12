-- ============================================================================
-- Lets a product be assigned to a supplier directly from the product form.
-- products.supplier_id is optional; the supplier's page lists every product
-- assigned to it here, in addition to products derived from purchase history.
-- Deleting a supplier just unlinks its products.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

alter table public.products add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists products_supplier_id_idx on public.products (supplier_id);
