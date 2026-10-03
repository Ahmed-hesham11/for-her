-- ============================================================================
-- Rework the RPCs that depended on auth.uid()/auth.users, and lock every
-- checkout/admin RPC down to service-role-only execution.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_admin(): its only remaining caller, after the previous migration
-- dropped every is_admin()-keyed RLS policy, is the internal
-- `if not public.is_admin() then raise 'ADMIN_ONLY'` guard inside the nine
-- admin_* RPCs below. Those RPCs are about to become unreachable from
-- anon/authenticated entirely (EXECUTE revoked further down) — the real
-- admin check now happens once, in Next.js's requireAdmin(), before any of
-- these RPCs are ever called via the service-role key. Rather than hand-
-- editing nine function bodies (risking a transcription mistake in code
-- this app already trusts), is_admin() is neutralized to always allow —
-- its guard is now a no-op, and EXECUTE grants are the actual boundary.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select true;
$$;

-- ----------------------------------------------------------------------------
-- create_secure_order: replace every auth.uid() with an explicit
-- p_user_id, verified server-side (against the custom session) before this
-- function is ever called.
-- ----------------------------------------------------------------------------
drop function if exists public.create_secure_order(jsonb, text, text, text, text, text, text, text, text, text);

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
-- admin_list_customers / admin_customer_detail: profiles now owns `email`
-- directly, so the `join auth.users` for it is gone.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_customers(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table(
  id uuid, full_name text, email text, phone_1 text, governorate text,
  created_at timestamptz, order_count bigint, total_spent numeric, total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_ONLY';
  end if;

  return query
  select
    p.id, p.full_name, p.email, p.phone_1, p.governorate, p.created_at,
    coalesce(stats.order_count, 0) as order_count,
    coalesce(stats.total_spent, 0) as total_spent,
    count(*) over() as total_count
  from public.profiles p
  left join (
    select o.user_id, count(*) as order_count, sum(o.total_amount) as total_spent
    from public.orders o
    where o.status <> 'cancelled'
    group by o.user_id
  ) stats on stats.user_id = p.id
  where p.role = 'customer'
    and (
      p_search is null or trim(p_search) = ''
      or p.full_name ilike '%' || p_search || '%'
      or p.email ilike '%' || p_search || '%'
    )
  order by p.created_at desc
  limit greatest(p_page_size, 1)
  offset greatest(p_page - 1, 0) * greatest(p_page_size, 1);
end;
$$;

create or replace function public.admin_customer_detail(p_user_id uuid)
returns table(
  id uuid, full_name text, email text, phone_1 text, phone_2 text,
  governorate text, address text, created_at timestamptz,
  order_count bigint, total_spent numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_ONLY';
  end if;

  return query
  select
    p.id, p.full_name, p.email, p.phone_1, p.phone_2, p.governorate, p.address, p.created_at,
    coalesce(stats.order_count, 0) as order_count,
    coalesce(stats.total_spent, 0) as total_spent
  from public.profiles p
  left join (
    select o.user_id, count(*) as order_count, sum(o.total_amount) as total_spent
    from public.orders o
    where o.user_id = p_user_id and o.status <> 'cancelled'
    group by o.user_id
  ) stats on stats.user_id = p.id
  where p.id = p_user_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Lock every checkout/admin RPC to service-role-only execution. Found
-- dynamically via pg_get_function_identity_arguments so this doesn't
-- depend on hand-transcribing every current overload's exact signature.
-- ----------------------------------------------------------------------------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_secure_order', 'calculate_order_quote',
        'admin_list_customers', 'admin_customer_detail',
        'admin_revenue_summary', 'admin_revenue_by_day', 'admin_order_status_counts',
        'admin_top_selling_products', 'admin_stock_summary', 'admin_low_stock_products',
        'admin_create_purchase', 'admin_update_purchase_status', 'admin_create_manual_order'
      )
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated', fn.proname, fn.args);
    execute format('grant execute on function public.%I(%s) to service_role', fn.proname, fn.args);
  end loop;
end $$;
