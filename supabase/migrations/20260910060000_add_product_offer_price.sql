-- The optional original price marks a product as an offer when it is higher
-- than its public selling price. Existing catalog data remains unchanged.
alter table public.products
  add column if not exists original_price numeric(12, 2);

alter table public.products
  drop constraint if exists products_original_price_greater_than_selling_price;

alter table public.products
  add constraint products_original_price_greater_than_selling_price
  check (original_price is null or original_price > selling_price);
