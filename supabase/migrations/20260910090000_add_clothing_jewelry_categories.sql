-- ============================================================================
-- Seed the requested clothing + jewelry/accessory categories.
--
-- Idempotent: skips any name that already exists (case-insensitive), so this
-- is safe to run more than once. No image_url set — add photos later via
-- Admin -> Categories (once the catalog-images storage bucket migration has
-- been applied). All rows are created active (is_active = true) so they
-- appear on the storefront immediately.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

insert into public.categories (name, is_active)
select v.name, true
from (values
  ('Blouse'), ('Chemise'), ('Burkini'), ('Swimsuit'), ('Pants'), ('Jeans'),
  ('Jacket'), ('Coat'), ('T-Shirt'), ('Hoodie'), ('Scarf'), ('Dress'),
  ('Top'), ('Basic Sweater'), ('Pullover'), ('Skirt'), ('Pyjama'), ('Suit'),
  ('Hand Chain'), ('Necklace'), ('Ring'), ('Earring'), ('Bracelet'),
  ('Ankle Bracelet'), ('Bangles')
) as v(name)
where not exists (
  select 1 from public.categories c where lower(c.name) = lower(v.name)
);
