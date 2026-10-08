-- ============================================================================
-- Lets a custom (off-catalog) line on a social-media order carry its own
-- photo — there's no products row behind it to join an image from (unlike a
-- catalog line, which still gets its image via order_items.product_id ->
-- products.image_url exactly as before).
--
-- order_items.image_url is new and stays null for every catalog line; it's
-- only ever set for a custom line, straight from the admin's upload.
-- getAdminOrderById (lib/admin/orders.ts) already prefers this column over
-- the joined product's image once this migration lands — no other code
-- changes needed there.
--
-- admin_create_manual_order's p_items element shape grows one more optional
-- key, 'image_url', read only when 'product_id' is null (a custom line).
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

alter table public.order_items add column if not exists image_url text;

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
  custom_unit_price numeric;
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

    if nullif(trim(item->>'product_id'), '') is not null then
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

      subtotal := subtotal + (product_row.selling_price * requested_quantity);
    else
      if nullif(trim(item->>'custom_name'), '') is null then
        raise exception using errcode = 'P0001', message = 'CUSTOM_ITEM_NAME_REQUIRED';
      end if;
      custom_unit_price := (item->>'unit_price')::numeric;
      if custom_unit_price is null or custom_unit_price < 0 then
        raise exception using errcode = 'P0001', message = 'INVALID_CUSTOM_PRICE';
      end if;

      subtotal := subtotal + (custom_unit_price * requested_quantity);
    end if;
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

    if nullif(trim(item->>'product_id'), '') is not null then
      select id, name, sku, selling_price, purchase_price into product_row
        from products where id::text = item->>'product_id' for update;

      insert into order_items (order_id, product_id, product_name, sku, quantity, unit_price, total_price, unit_cost)
      values (
        order_id, product_row.id, product_row.name, product_row.sku,
        requested_quantity, product_row.selling_price,
        product_row.selling_price * requested_quantity, product_row.purchase_price
      );

      update products
         set stock_quantity = stock_quantity - requested_quantity
       where id = product_row.id;
    else
      custom_unit_price := (item->>'unit_price')::numeric;

      insert into order_items (order_id, product_id, product_name, sku, quantity, unit_price, total_price, unit_cost, image_url)
      values (
        order_id, null, trim(item->>'custom_name'), null,
        requested_quantity, custom_unit_price,
        custom_unit_price * requested_quantity, null,
        nullif(trim(item->>'image_url'), '')
      );
    end if;
  end loop;

  return order_id;
end;
$$;

revoke all on function public.admin_create_manual_order(text, text, text, text, text, text, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.admin_create_manual_order(text, text, text, text, text, text, text, numeric, jsonb) to service_role;
