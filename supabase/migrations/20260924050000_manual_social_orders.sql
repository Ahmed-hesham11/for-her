-- ============================================================================
-- Lets an admin log an order that came in through social media DMs/comments
-- rather than the storefront checkout. It becomes a real row in `orders` /
-- `order_items` — deducts stock exactly like create_secure_order, and from
-- then on is indistinguishable from a website order to the rest of the
-- admin (dashboard KPIs, WhatsApp confirm, print invoice, status editing all
-- already just work off the orders table). The only difference: there's no
-- authenticated customer behind it, so user_id is left null, and a new
-- `source` column ('website' | 'social') marks where it came from.
--
-- orders.user_id must be nullable for that — this migration drops its
-- NOT NULL constraint if it has one (a no-op if it's already nullable).
-- Existing RLS is unaffected: `orders_own_read` checks `user_id = auth.uid()`,
-- which a null user_id never satisfies for any customer, so these rows stay
-- admin-only exactly like everything else on this table already is for a
-- non-owner.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists source text not null default 'website';

create or replace function public.admin_create_manual_order(
  p_customer_name text,
  p_phone_1 text,
  p_phone_2 text default null,
  p_governorate text default null,
  p_address text default null,
  p_payment_method text default 'cod',
  p_notes text default null,
  p_discount numeric default 0,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  product_row record;
  order_id uuid;
  requested_quantity integer;
  subtotal numeric(12, 2) := 0;
  shipping_fee numeric(12, 2) := 0;
  discount numeric(12, 2) := 0;
  total_amount numeric(12, 2) := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_ONLY';
  end if;
  if p_customer_name is null or trim(p_customer_name) = '' then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_NAME_REQUIRED';
  end if;
  if p_phone_1 is null or trim(p_phone_1) = '' then
    raise exception using errcode = 'P0001', message = 'PHONE_REQUIRED';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_ITEMS';
  end if;
  if p_payment_method not in ('cod', 'card') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_METHOD';
  end if;

  select sr.shipping_fee into shipping_fee
    from shipping_rates sr
   where lower(trim(sr.governorate)) = lower(trim(p_governorate)) and sr.is_active;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_GOVERNORATE';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    requested_quantity := (item->>'quantity')::integer;
    if requested_quantity is null or requested_quantity < 1 then
      raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
    end if;

    select id, name, sku, selling_price, stock_quantity, is_active
      into product_row
      from products
     where id::text = item->>'product_id'
     for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
    end if;
    if not product_row.is_active then
      raise exception using errcode = 'P0001', message = 'INACTIVE_PRODUCT';
    end if;
    if requested_quantity > coalesce(product_row.stock_quantity, 0) then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK:' || product_row.name;
    end if;

    subtotal := subtotal + (product_row.selling_price * requested_quantity);
  end loop;

  discount := least(greatest(coalesce(p_discount, 0), 0), subtotal);
  total_amount := greatest(subtotal + shipping_fee - discount, 0);

  insert into orders (
    user_id, customer_name, phone_1, phone_2, governorate, address,
    payment_method, payment_status, status, subtotal, discount, shipping_fee,
    total_amount, notes, source
  ) values (
    null, trim(p_customer_name), trim(p_phone_1), nullif(trim(p_phone_2), ''), p_governorate,
    p_address, p_payment_method, 'pending', 'pending', subtotal, discount,
    shipping_fee, total_amount, nullif(trim(p_notes), ''), 'social'
  ) returning id into order_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    requested_quantity := (item->>'quantity')::integer;
    select id, name, sku, selling_price into product_row
      from products where id::text = item->>'product_id' for update;

    insert into order_items (order_id, product_id, product_name, sku, quantity, unit_price, total_price)
    values (
      order_id, product_row.id, product_row.name, product_row.sku,
      requested_quantity, product_row.selling_price,
      product_row.selling_price * requested_quantity
    );

    update products
       set stock_quantity = stock_quantity - requested_quantity
     where id = product_row.id and stock_quantity >= requested_quantity;
    if not found then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK:' || product_row.name;
    end if;
  end loop;

  return order_id;
end;
$$;

revoke all on function public.admin_create_manual_order(text, text, text, text, text, text, text, numeric, jsonb) from public;
grant execute on function public.admin_create_manual_order(text, text, text, text, text, text, text, numeric, jsonb) to authenticated;
