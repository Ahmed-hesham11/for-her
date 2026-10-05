-- ============================================================================
-- Adds profit tracking to the admin dashboard. order_items never recorded
-- what a line item actually cost the store — only its selling price — so
-- profit could not be computed at all, let alone accurately for past orders
-- (products.purchase_price is overwritten on every restock via
-- admin_create_purchase, so it only ever reflects the *latest* cost, not
-- whatever it was when a given historical order was placed).
--
-- This migration:
--   1. Adds order_items.unit_cost, a snapshot of products.purchase_price at
--      the moment the order was placed (same idea as unit_price/product_name
--      /sku already being snapshotted there instead of live-joined).
--   2. Backfills existing rows with today's products.purchase_price as a
--      best-effort approximation — there is no way to recover the true
--      historical cost for orders placed before this column existed, so
--      profit figures for those orders (and any order for a product whose
--      cost has changed since) stay an approximation, never exact.
--   3. Updates create_secure_order and admin_create_manual_order to snapshot
--      unit_cost on every new order_items row going forward, so profit for
--      every order placed from here on is exact.
--   4. Adds admin_revenue_profit_by_range(p_from, p_to) — the same
--      generate_series-over-orders shape as admin_revenue_by_day, but over
--      an explicit date range instead of a trailing window, and with
--      cost/profit alongside revenue.
--
-- "Profit" here means revenue (orders.total_amount, same definition already
-- used by admin_revenue_summary/admin_revenue_by_day — i.e. after discount,
-- including shipping fee) minus cost of goods sold (sum of unit_cost *
-- quantity). It does not deduct shipping cost, payment processing fees, or
-- returns — it's gross margin on goods sold, not full net profit.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved for steps 1-2; steps 3-4 are SECURITY DEFINER
-- functions callable only by service_role, matching every other admin/order
-- RPC since 20260927030000_rpc_rewrite.sql.
-- ============================================================================

alter table public.order_items add column if not exists unit_cost numeric;

update public.order_items oi
   set unit_cost = p.purchase_price
  from public.products p
 where oi.product_id = p.id
   and oi.unit_cost is null;

-- ----------------------------------------------------------------------------
-- create_secure_order: same signature as 20260927030000_rpc_rewrite.sql,
-- body unchanged except the insert loop now also captures purchase_price
-- and snapshots it into the new column.
-- ----------------------------------------------------------------------------
create or replace function public.create_secure_order(
  p_user_id uuid,
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
  if p_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_CART';
  end if;
  if p_payment_method not in ('cod', 'card') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_METHOD';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if nullif(trim(p_request_id), '') is not null then
    select o.id, o.order_number, o.subtotal, o.discount, o.shipping_fee, o.total_amount
      into order_row
      from orders o
     where o.user_id = p_user_id and o.request_id = trim(p_request_id)
     order by o.created_at desc
     limit 1;
    if found then
      return jsonb_build_object('order_id', order_row.id, 'order_number', order_row.order_number,
        'subtotal', round(order_row.subtotal, 2), 'discount', round(order_row.discount, 2),
        'shipping_fee', round(order_row.shipping_fee, 2), 'total_amount', round(order_row.total_amount, 2));
    end if;
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

  total_amount := greatest(subtotal + shipping_fee - discount, 0);

  insert into orders (
    user_id, customer_name, phone_1, phone_2, governorate, address,
    payment_method, payment_status, status, subtotal, discount, shipping_fee,
    total_amount, coupon_id, notes, request_id
  ) values (
    p_user_id, p_customer_name, p_phone_1, nullif(p_phone_2, ''), p_governorate,
    p_address, p_payment_method, 'pending', 'pending', subtotal, discount,
    shipping_fee, total_amount, coupon_id,
    nullif(trim(p_notes), ''), nullif(trim(p_request_id), '')
  ) returning id, order_number into order_row;

  for item in select value from jsonb_array_elements(p_items)
  loop
    requested_quantity := (item->>'quantity')::integer;
    select id, name, sku, selling_price, purchase_price into product_row
      from products where id::text = item->>'product_id' for update;

    insert into order_items (order_id, product_id, product_name, sku, quantity, unit_price, total_price, unit_cost)
    values (
      order_row.id, product_row.id, product_row.name, product_row.sku,
      requested_quantity, product_row.selling_price,
      product_row.selling_price * requested_quantity, product_row.purchase_price
    );

    update products
       set stock_quantity = stock_quantity - requested_quantity
     where id = product_row.id and stock_quantity >= requested_quantity;
    if not found then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK:' || product_row.name;
    end if;
  end loop;

  select id into cart_row from carts where user_id = p_user_id for update;
  if found then
    delete from cart_items where cart_id = cart_row.id;
  end if;

  return jsonb_build_object('order_id', order_row.id, 'order_number', order_row.order_number,
    'subtotal', round(subtotal, 2), 'discount', round(discount, 2),
    'shipping_fee', round(shipping_fee, 2), 'total_amount', round(total_amount, 2));
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_create_manual_order: same signature as
-- 20260924050000_manual_social_orders.sql, same unit_cost snapshot change.
-- ----------------------------------------------------------------------------
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
     where id = product_row.id and stock_quantity >= requested_quantity;
    if not found then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK:' || product_row.name;
    end if;
  end loop;

  return order_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_revenue_profit_by_range: same generate_series-over-orders shape as
-- admin_revenue_by_day (20260904040000), but over an explicit [p_from, p_to]
-- range instead of a trailing window, with cost/profit alongside revenue.
-- Defaults reproduce admin_revenue_by_day(14)'s window when called with no
-- arguments.
-- ----------------------------------------------------------------------------
create or replace function public.admin_revenue_profit_by_range(
  p_from date default current_date - 13,
  p_to date default current_date
)
returns table(day date, revenue numeric, cost numeric, profit numeric, orders_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    d::date as day,
    coalesce(sum(o.total_amount), 0) as revenue,
    coalesce(sum(items.cost), 0) as cost,
    coalesce(sum(o.total_amount), 0) - coalesce(sum(items.cost), 0) as profit,
    count(distinct o.id) as orders_count
  from generate_series(least(p_from, p_to), greatest(p_from, p_to), interval '1 day') d
  left join orders o on o.created_at::date = d::date and o.status <> 'cancelled'
  left join (
    select order_id, sum(coalesce(unit_cost, 0) * quantity) as cost
    from order_items
    group by order_id
  ) items on items.order_id = o.id
  where public.is_admin()
  group by d
  order by d;
$$;

revoke all on function public.create_secure_order(uuid, jsonb, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_secure_order(uuid, jsonb, text, text, text, text, text, text, text, text, text) to service_role;

revoke all on function public.admin_create_manual_order(text, text, text, text, text, text, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.admin_create_manual_order(text, text, text, text, text, text, text, numeric, jsonb) to service_role;

revoke all on function public.admin_revenue_profit_by_range(date, date) from public, anon, authenticated;
grant execute on function public.admin_revenue_profit_by_range(date, date) to service_role;
