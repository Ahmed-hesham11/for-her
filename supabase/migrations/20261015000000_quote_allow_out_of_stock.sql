-- ============================================================================
-- The checkout page's price preview (calculate_order_quote) still rejected
-- items whose requested quantity exceeded stock ('INSUFFICIENT_STOCK:<name>'),
-- even after 20261008030000 removed that check from create_secure_order and
-- admin_create_manual_order. This removes it here too; nothing else changes.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

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

    select id, name, sku, selling_price, is_active
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

revoke all on function public.calculate_order_quote(jsonb, text, text) from public;
grant execute on function public.calculate_order_quote(jsonb, text, text) to authenticated;
