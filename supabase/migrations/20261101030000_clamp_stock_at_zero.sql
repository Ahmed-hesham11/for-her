-- Orders are accepted even when stock is 0 (see
-- 20261008030000_allow_ordering_when_out_of_stock.sql), which used to push
-- products.stock_quantity below zero. Clamp it at 0 for every write path
-- (order RPCs, purchases, manual edits) with one trigger instead of
-- rewriting each function that touches stock.

create or replace function public.clamp_product_stock_at_zero()
returns trigger
language plpgsql
as $$
begin
  if new.stock_quantity < 0 then
    new.stock_quantity := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists products_clamp_stock_at_zero on public.products;
create trigger products_clamp_stock_at_zero
  before insert or update of stock_quantity on public.products
  for each row execute function public.clamp_product_stock_at_zero();

-- Fix products that are already negative.
update public.products set stock_quantity = 0 where stock_quantity < 0;
