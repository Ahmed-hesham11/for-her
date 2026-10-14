-- ============================================================================
-- Many-to-many product <-> supplier relationship.
--
-- Replaces the single products.supplier_id link (20261012010000_product_supplier.sql)
-- with a proper join table so one product can have several suppliers, each with
-- its own purchase price, and one supplier can supply many products.
--
-- Safe to re-run. Nothing is deleted:
--   * Every product that has a supplier_id is copied into supplier_products
--     (purchase_price starts at the product's current products.purchase_price).
--   * products.supplier_id is left in place, unused by the app from now on, so
--     this migration can be rolled back without data loss. Drop it later once
--     you are happy with the new table.
--   * purchases / purchase_items are not touched, so historical costs are
--     unchanged. Editing or removing a supplier_products row never rewrites a
--     past purchase, and never changes products.selling_price.
--
-- Access: RLS is enabled with NO policies and no anon/authenticated grants —
-- supplier prices are internal. Only the server (service role) can read/write,
-- exactly like purchases and suppliers.
--
-- Run this BEFORE 20261014010000_product_colors_sizes.sql (its
-- admin_save_product_options function writes to this table).
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
  supplier_sku text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_products_supplier_product_key unique (supplier_id, product_id)
);

create index if not exists supplier_products_product_id_idx on public.supplier_products (product_id);

create or replace function public.supplier_products_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists supplier_products_touch_updated_at on public.supplier_products;
create trigger supplier_products_touch_updated_at
  before update on public.supplier_products
  for each row execute function public.supplier_products_touch_updated_at();

alter table public.supplier_products enable row level security;
revoke all on public.supplier_products from anon, authenticated;
grant all privileges on public.supplier_products to service_role;

-- Preserve every existing single-supplier assignment.
insert into public.supplier_products (supplier_id, product_id, purchase_price)
select p.supplier_id, p.id, coalesce(p.purchase_price, 0)
  from public.products p
 where p.supplier_id is not null
on conflict (supplier_id, product_id) do nothing;

comment on column public.products.supplier_id is
  'DEPRECATED — superseded by public.supplier_products. Kept for rollback; no longer read or written by the app.';
