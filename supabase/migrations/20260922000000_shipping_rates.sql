-- ============================================================================
-- SHIPPING: per-governorate shipping prices, set by the admin and enforced
-- at checkout — replaces the flat, hardcoded `shipping_fee := 8` that both
-- calculate_order_quote() and create_secure_order() currently use.
--
-- WHAT THIS ADDS:
--   - public.shipping_rates: one row per Egyptian governorate, each with its
--     own shipping_fee, editable from Admin -> Shipping.
--   - calculate_order_quote(): gains a p_governorate parameter (signature
--     change, so the old 2-arg overload is dropped first) — shipping_fee is
--     now looked up from shipping_rates instead of hardcoded. Lenient: if no
--     governorate is given yet (quote requested before the customer picks
--     one) or it doesn't match an active rate, shipping_fee stays 0 — this
--     is only a live preview, not a charge.
--   - create_secure_order(): same lookup, but strict — a governorate that
--     doesn't match an active shipping_rates row raises INVALID_GOVERNORATE.
--     This is the function that actually charges the customer, so it must
--     never silently fall back to 0 shipping. Signature is unchanged
--     (p_governorate already existed as a parameter, just unused for
--     pricing until now).
--
-- Governorate matching is case/whitespace-insensitive but otherwise exact —
-- the checkout page's governorate field becomes a <select> sourced from this
-- same table, so submitted values always match a row exactly in practice.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor
-- when you approve it. No service-role key involved; runs under your own
-- session.
-- ============================================================================

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  governorate text not null unique,
  shipping_fee numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.shipping_rates enable row level security;

-- Public read (same shape as products/categories in Phase 1) — the checkout
-- page's governorate dropdown reads this table directly.
grant select on public.shipping_rates to anon, authenticated;

drop policy if exists "shipping_rates_public_read" on public.shipping_rates;
create policy "shipping_rates_public_read" on public.shipping_rates
  for select using (is_active);

-- Admin-only writes, reusing the is_admin() helper from Phase 4.
grant select, insert, update, delete on public.shipping_rates to authenticated;

drop policy if exists "shipping_rates_admin_all" on public.shipping_rates;
create policy "shipping_rates_admin_all" on public.shipping_rates
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Seed Egypt's 27 governorates. Idempotent (unique governorate + do nothing
-- on conflict) — safe to run more than once. Fees default to 0 so nothing is
-- silently charged; set real prices from Admin -> Shipping right after.
-- ----------------------------------------------------------------------------
insert into public.shipping_rates (governorate)
values
  ('القاهرة'), ('الجيزة'), ('الإسكندرية'), ('الدقهلية'), ('البحر الأحمر'),
  ('البحيرة'), ('الفيوم'), ('الغربية'), ('الإسماعيلية'), ('المنوفية'),
  ('المنيا'), ('القليوبية'), ('الوادي الجديد'), ('السويس'), ('أسوان'),
  ('أسيوط'), ('بني سويف'), ('بورسعيد'), ('دمياط'), ('الشرقية'),
  ('جنوب سيناء'), ('كفر الشيخ'), ('مطروح'), ('الأقصر'), ('قنا'),
  ('شمال سيناء'), ('سوهاج')
on conflict (governorate) do nothing;

-- ----------------------------------------------------------------------------
-- calculate_order_quote(): add p_governorate. Signature change -> drop the
-- old 2-arg overload first, then create the 3-arg version. Body is otherwise
-- byte-for-byte the same as the current definition (20260904050000).
-- ----------------------------------------------------------------------------
drop function if exists public.calculate_order_quote(jsonb, text);

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

  if nullif(trim(p_governorate), '') is not null then
    select sr.shipping_fee into shipping_fee
      from shipping_rates sr
     where lower(trim(sr.governorate)) = lower(trim(p_governorate)) and sr.is_active;
    -- Not found: leave shipping_fee at 0 — this is a preview quote, not a
    -- charge, so an unmatched/not-yet-chosen governorate isn't an error here.
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

revoke all on function public.calculate_order_quote(jsonb, text, text) from public;
grant execute on function public.calculate_order_quote(jsonb, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- create_secure_order(): same signature (p_governorate already existed) —
-- only the `shipping_fee := 8;` line becomes a strict shipping_rates lookup.
-- Everything else is byte-for-byte the same as 20260913000000's version.
-- ----------------------------------------------------------------------------
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
    select o.id, o.order_number, o.subtotal, o.discount, o.shipping_fee, o.total_amount
      into order_row
      from orders o
     where o.user_id = auth.uid() and o.notes = 'checkout-request:' || trim(p_request_id)
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

revoke all on function public.create_secure_order(jsonb, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_secure_order(jsonb, text, text, text, text, text, text, text, text, text) to authenticated;
