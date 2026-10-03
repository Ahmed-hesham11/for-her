-- ============================================================================
-- PHASE 3: checkout (real orders) + "My Orders" / order detail for customers.
--
-- WHY THIS IS NEEDED (found by inspection, not assumed):
--   `create_secure_order` and `calculate_order_quote` (from the pre-existing
--   20260903190000_secure_order_flow.sql migration) already do everything
--   Phase 3 asks for — server-side price/stock/coupon recalculation, user_id
--   taken from auth.uid() (never from the client), idempotent retries — and
--   the checkout UI/API routes already only ever send { product_id, quantity }
--   to them, never a price or total. Nothing there needed to change.
--
--   The actual gap: both functions are `security invoker`, so their internal
--   writes (insert into orders/order_items, update products.stock_quantity,
--   update coupons.used_count, delete from cart_items) run as the CALLING
--   customer's own role. After Phase 1/2/4 enabled RLS on products/orders/
--   order_items with only "public read active" and "admin" policies, a normal
--   customer has no policy allowing them to write to any of those tables —
--   so checkout would fail for every non-admin user. Flipping these two
--   functions to `security definer` (their bodies are otherwise byte-for-byte
--   unchanged) fixes this the standard, narrow way: the function's own
--   internal logic is the security boundary (auth.uid() required, ownership
--   enforced, price/stock recomputed from the DB), not the caller's table
--   grants. This does not grant customers any new direct table access.
--
--   Separately, customers still need to be able to *read* their own past
--   orders directly (the Orders list and order-detail pages use plain
--   `.from("orders").select()`, not the RPC) — that policy did not exist
--   yet (Phase 4 only added the admin-all policy). Added below.
--
-- Deliberately NOT included here:
--   - No customer INSERT/UPDATE policy on orders/order_items — order
--     creation only ever happens through the SECURITY DEFINER RPC above, so
--     customers have zero direct write access to those tables. This is
--     intentional: it's what makes "insert a fake order total from the
--     browser console" impossible, not just discouraged.
--   - No coupons grant/policy — nothing in the app queries `coupons`
--     directly; both RPCs read it internally and now bypass RLS as
--     security definer, so no policy is needed for checkout to work.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor
-- when ready. No service-role key involved.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Flip both checkout RPCs to SECURITY DEFINER. Bodies are unchanged from
--    20260903190000_secure_order_flow.sql — only `security invoker` becomes
--    `security definer` on each.
-- ----------------------------------------------------------------------------
create or replace function public.calculate_order_quote(
  p_items jsonb,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  product_row record;
  coupon_row record;
  requested_quantity integer;
  subtotal numeric(12, 2) := 0;
  discount numeric(12, 2) := 0;
  shipping_fee numeric(12, 2) := 0;
  total_amount numeric(12, 2) := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_CART';
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
     where id::text = item->>'product_id';

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

  if nullif(trim(p_coupon_code), '') is not null then
    select * into coupon_row
      from coupons
     where lower(code) = lower(trim(p_coupon_code))
     for update;

    if not found or not coupon_row.is_active then
      raise exception using errcode = 'P0001', message = 'INVALID_COUPON';
    end if;
    if coupon_row.expires_at is not null and coupon_row.expires_at <= now() then
      raise exception using errcode = 'P0001', message = 'EXPIRED_COUPON';
    end if;
    if coupon_row.min_order_amount is not null and subtotal < coupon_row.min_order_amount then
      raise exception using errcode = 'P0001', message = 'MINIMUM_ORDER_NOT_MET';
    end if;
    if coupon_row.max_uses is not null and coalesce(coupon_row.used_count, 0) >= coupon_row.max_uses then
      raise exception using errcode = 'P0001', message = 'COUPON_USAGE_LIMIT_REACHED';
    end if;

    if lower(coupon_row.discount_type) in ('percentage', 'percent') then
      discount := subtotal * coupon_row.discount_value / 100;
    else
      discount := coupon_row.discount_value;
    end if;
    discount := least(greatest(discount, 0), subtotal);
  end if;

  if jsonb_array_length(p_items) > 0 then
    shipping_fee := 8;
  end if;
  total_amount := greatest(subtotal + shipping_fee - discount, 0);

  return jsonb_build_object(
    'subtotal', round(subtotal, 2),
    'discount', round(discount, 2),
    'shipping_fee', round(shipping_fee, 2),
    'total_amount', round(total_amount, 2)
  );
end;
$$;

create or replace function public.create_secure_order(
  p_items jsonb,
  p_coupon_code text default null,
  p_customer_name text default null,
  p_phone_1 text default null,
  p_phone_2 text default null,
  p_governorate text default null,
  p_address text default null,
  p_payment_method text default 'cod',
  p_notes text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  product_row record;
  coupon_row record;
  order_row record;
  cart_row record;
  requested_quantity integer;
  item_total numeric(12, 2);
  subtotal numeric(12, 2) := 0;
  discount numeric(12, 2) := 0;
  shipping_fee numeric(12, 2) := 0;
  total_amount numeric(12, 2) := 0;
  coupon_id coupons.id%TYPE := null;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_CART';
  end if;
  if p_payment_method not in ('cod', 'card') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_METHOD';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if nullif(trim(p_request_id), '') is not null then
    select id, order_number, subtotal, discount, shipping_fee, total_amount
      into order_row
      from orders
     where user_id = auth.uid() and notes = 'checkout-request:' || trim(p_request_id)
     order by created_at desc
     limit 1;
    if found then
      return jsonb_build_object('order_id', order_row.id, 'order_number', order_row.order_number,
        'subtotal', round(order_row.subtotal, 2), 'discount', round(order_row.discount, 2),
        'shipping_fee', round(order_row.shipping_fee, 2), 'total_amount', round(order_row.total_amount, 2));
    end if;
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

    item_total := product_row.selling_price * requested_quantity;
    subtotal := subtotal + item_total;
  end loop;

  if nullif(trim(p_coupon_code), '') is not null then
    select * into coupon_row
      from coupons
     where lower(code) = lower(trim(p_coupon_code))
     for update;

    if not found or not coupon_row.is_active then
      raise exception using errcode = 'P0001', message = 'INVALID_COUPON';
    end if;
    if coupon_row.expires_at is not null and coupon_row.expires_at <= now() then
      raise exception using errcode = 'P0001', message = 'EXPIRED_COUPON';
    end if;
    if coupon_row.min_order_amount is not null and subtotal < coupon_row.min_order_amount then
      raise exception using errcode = 'P0001', message = 'MINIMUM_ORDER_NOT_MET';
    end if;
    if coupon_row.max_uses is not null and coalesce(coupon_row.used_count, 0) >= coupon_row.max_uses then
      raise exception using errcode = 'P0001', message = 'COUPON_USAGE_LIMIT_REACHED';
    end if;

    coupon_id := coupon_row.id;
    if lower(coupon_row.discount_type) in ('percentage', 'percent') then
      discount := subtotal * coupon_row.discount_value / 100;
    else
      discount := coupon_row.discount_value;
    end if;
    discount := least(greatest(discount, 0), subtotal);
    update coupons set used_count = coalesce(used_count, 0) + 1 where id = coupon_row.id;
  end if;

  shipping_fee := 8;
  total_amount := greatest(subtotal + shipping_fee - discount, 0);

  insert into orders (
    user_id, customer_name, phone_1, phone_2, governorate, address,
    payment_method, payment_status, status, subtotal, discount, shipping_fee,
    total_amount, coupon_id, notes
  ) values (
    auth.uid(), p_customer_name, p_phone_1, nullif(p_phone_2, ''), p_governorate,
    p_address, p_payment_method, 'pending', 'pending', subtotal, discount,
    shipping_fee, total_amount, coupon_id,
    coalesce('checkout-request:' || nullif(trim(p_request_id), ''), p_notes)
  ) returning id, order_number into order_row;

  for item in select value from jsonb_array_elements(p_items)
  loop
    requested_quantity := (item->>'quantity')::integer;
    select id, name, sku, selling_price into product_row
      from products where id::text = item->>'product_id' for update;

    insert into order_items (order_id, product_id, product_name, sku, quantity, unit_price, total_price)
    values (
      order_row.id, product_row.id, product_row.name, product_row.sku,
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

  select id into cart_row from carts where user_id = auth.uid() for update;
  if found then
    delete from cart_items where cart_id = cart_row.id;
  end if;

  return jsonb_build_object('order_id', order_row.id, 'order_number', order_row.order_number,
    'subtotal', round(subtotal, 2), 'discount', round(discount, 2),
    'shipping_fee', round(shipping_fee, 2), 'total_amount', round(total_amount, 2));
end;
$$;

revoke all on function public.calculate_order_quote(jsonb, text) from public;
revoke all on function public.create_secure_order(jsonb, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.calculate_order_quote(jsonb, text) to authenticated;
grant execute on function public.create_secure_order(jsonb, text, text, text, text, text, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Customers may read their own orders/order_items directly (the Orders
--    list and order-detail pages query these tables directly, not via RPC).
--    Additive to Phase 4's admin-all policy — no INSERT/UPDATE for customers.
-- ----------------------------------------------------------------------------
drop policy if exists "orders_own_read" on public.orders;
create policy "orders_own_read" on public.orders
  for select using (user_id = auth.uid());

drop policy if exists "order_items_own_read" on public.order_items;
create policy "order_items_own_read" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );
