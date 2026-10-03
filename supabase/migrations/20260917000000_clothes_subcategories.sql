-- ============================================================================
-- Add hierarchical subcategories, scoped to Clothes only.
--
-- Adds one nullable, self-referencing column to categories. Nothing on
-- `products` changes — a product still stores the single, specific category
-- (e.g. "Dresses") in products.category_id, exactly as before. "Clothes" is
-- just the parent of that row now; the id a product references never
-- changes, so no product can become uncategorized by this migration.
--
-- Then: create the "Clothes" parent row (idempotent) and re-point the 18
-- clothing categories you already have at it. Everything else (jewelry
-- items, and any future Bags/Accessories) is untouched — parent_id stays
-- null, i.e. they remain normal top-level categories.
--
-- RLS needs no changes: parent_id is just another column already covered by
-- the existing categories_public_read / categories_admin_all policies.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;

create index if not exists categories_parent_id_idx on public.categories(parent_id);

insert into public.categories (name, is_active)
select 'Clothes', true
where not exists (select 1 from public.categories where lower(name) = 'clothes');

update public.categories c
set parent_id = (select id from public.categories where lower(name) = 'clothes')
where lower(c.name) in (
  'dress', 'blouse', 'chemise', 'burkini', 'swimsuit', 'pants', 'jeans',
  'jacket', 'coat', 't-shirt', 'hoodie', 'scarf', 'top', 'basic sweater',
  'pullover', 'skirt', 'pyjama', 'suit'
)
and lower(c.name) <> 'clothes';
