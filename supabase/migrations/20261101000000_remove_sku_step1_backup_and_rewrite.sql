-- ============================================================================
-- Remove SKU, step 1 of 2 (NON-DESTRUCTIVE): the product UUID (products.id) is
-- the only product identifier from here on.
--
--  1. Backs up every products.sku and order_items.sku into two new tables
--     (sku_backup_products, sku_backup_order_items). Nothing is deleted.
--  2. Makes products.sku / order_items.sku nullable and drops any NOT NULL /
--     UNIQUE constraint or index on products.sku, so the app (which no longer
--     writes SKU) can insert products and orders.
--  3. Re-creates every function that still read the sku column so none of them
--     depend on it any more (create_secure_order, calculate_order_quote,
--     admin_create_manual_order, admin_top_selling_products,
--     admin_low_stock_products). Bodies are copied unchanged from their latest
--     migrations apart from dropping the sku column/field.
--
-- The columns themselves are dropped by step 2
-- (20261101010000_remove_sku_step2_drop_columns.sql) — run that only after the
-- app version without SKU is deployed and checked. Rollback for both steps:
-- 20261101020000_remove_sku_rollback.sql (restores the columns + data).
--
-- Not applied automatically. Run via the Supabase SQL editor. Safe to re-run.
-- ============================================================================

-- 1. Backups -----------------------------------------------------------------
create table if not exists public.sku_backup_products as
  select id as product_id, sku from public.products;
create table if not exists public.sku_backup_order_items as
  select id as order_item_id, sku from public.order_items;
alter table public.sku_backup_products enable row level security;
alter table public.sku_backup_order_items enable row level security;
grant all on table public.sku_backup_products, public.sku_backup_order_items to service_role;

-- 2. Make the columns optional ------------------------------------------------
alter table public.products alter column sku drop not null;
alter table public.order_items alter column sku drop not null;

do $$
declare
  r record;
begin
  -- unique constraints that include products.sku
  for r in
    select c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = 'public.products'::regclass
       and c.contype = 'u'
       and a.attname = 'sku'
  loop
    execute format('alter table public.products drop constraint %I', r.conname);
  end loop;
  -- remaining (non-constraint) indexes on products.sku
  for r in
    select i.indexrelid::regclass::text as idx
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
     where i.indrelid = 'public.products'::regclass
       and a.attname = 'sku'
       and not i.indisprimary
       and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
  loop
    execute format('drop index %s', r.idx);
  end loop;
end $$;

-- 3. Functions without sku ----------------------------------------------------
-- create_secure_order
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
  option_row record;
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

    select id, name, selling_price, stock_quantity, is_active
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

    -- Raises COLOR_REQUIRED / INVALID_COLOR / SIZE_REQUIRED / INVALID_SIZE.
    perform 1 from public.resolve_item_options(
      product_row.id,
      nullif(item->>'color_id', '')::uuid,
      nullif(item->>'size_id', '')::uuid
    );

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
    select id, name, selling_price, purchase_price into product_row
      from products where id::text = item->>'product_id' for update;

    select * into option_row from public.resolve_item_options(
      product_row.id,
      nullif(item->>'color_id', '')::uuid,
      nullif(item->>'size_id', '')::uuid
    );

    insert into order_items (
      order_id, product_id, product_name, quantity, unit_price, total_price, unit_cost,
      color_id, color_name, size_id, size_name, image_url
    )
    values (
      order_row.id, product_row.id, product_row.name,
      requested_quantity, product_row.selling_price,
      product_row.selling_price * requested_quantity, product_row.purchase_price,
      option_row.r_color_id, option_row.r_color_name, option_row.r_size_id, option_row.r_size_name,
      option_row.r_color_image_url
    );

    update products
       set stock_quantity = stock_quantity - requested_quantity
     where id = product_row.id;
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

-- calculate_order_quote
create or replace function public.calculate_order_quote(
  p_items jsonb,
  p_coupon_code text default null,
  p_governorate text default null
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

    select id, name, selling_price, is_active
      into product_row
      from products
     where id::text = item->>'product_id';

    if not found then
      raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
    end if;
    if not product_row.is_active then
      raise exception using errcode = 'P0001', message = 'INACTIVE_PRODUCT';
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

  if nullif(trim(p_governorate), '') is not null then
    select sr.shipping_fee into shipping_fee
      from shipping_rates sr
     where lower(trim(sr.governorate)) = lower(trim(p_governorate)) and sr.is_active;
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

-- admin_create_manual_order
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
  override_price numeric;
  effective_price numeric;
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
      select id, name, selling_price, stock_quantity, is_active
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

      override_price := (item->>'unit_price')::numeric;
      if override_price is not null and override_price < 0 then
        raise exception using errcode = 'P0001', message = 'INVALID_CUSTOM_PRICE';
      end if;

      subtotal := subtotal + (coalesce(override_price, product_row.selling_price) * requested_quantity);
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
      select id, name, selling_price, purchase_price into product_row
        from products where id::text = item->>'product_id' for update;

      override_price := (item->>'unit_price')::numeric;
      effective_price := coalesce(override_price, product_row.selling_price);

      insert into order_items (order_id, product_id, product_name, quantity, unit_price, total_price, unit_cost)
      values (
        order_id, product_row.id, product_row.name,
        requested_quantity, effective_price,
        effective_price * requested_quantity, product_row.purchase_price
      );

      update products
         set stock_quantity = stock_quantity - requested_quantity
       where id = product_row.id;
    else
      custom_unit_price := (item->>'unit_price')::numeric;

      insert into order_items (order_id, product_id, product_name, quantity, unit_price, total_price, unit_cost, image_url)
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

-- admin_top_selling_products (return type changes, so drop first)
drop function if exists public.admin_top_selling_products(integer);
create function public.admin_top_selling_products(limit_count integer default 5)
returns table(product_id uuid, product_name text, units_sold bigint, revenue numeric)
language sql
security definer
set search_path = public
as $$
  with agg as (
    select oi.product_id, sum(oi.quantity)::bigint as units_sold, sum(oi.total_price) as revenue
    from order_items oi
    join orders o on o.id = oi.order_id
    where public.is_admin() and o.status <> 'cancelled'
    group by oi.product_id
  ),
  latest_snapshot as (
    select distinct on (oi.product_id) oi.product_id, oi.product_name
    from order_items oi
    join orders o on o.id = oi.order_id
    where public.is_admin() and o.status <> 'cancelled'
    order by oi.product_id, o.created_at desc
  )
  select a.product_id, s.product_name, a.units_sold, a.revenue
  from agg a
  join latest_snapshot s on s.product_id = a.product_id
  order by a.units_sold desc
  limit greatest(limit_count, 1);
$$;
revoke all on function public.admin_top_selling_products(integer) from public;
grant execute on function public.admin_top_selling_products(integer) to authenticated;

-- admin_low_stock_products
drop function if exists public.admin_low_stock_products(integer);
create function public.admin_low_stock_products(limit_count integer default 20)
returns table(id uuid, name text, stock_quantity integer)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.stock_quantity
  from products p
  where public.is_admin() and p.stock_quantity <= 5
  order by p.stock_quantity asc
  limit greatest(limit_count, 1);
$$;
revoke all on function public.admin_low_stock_products(integer) from public;
grant execute on function public.admin_low_stock_products(integer) to authenticated;
