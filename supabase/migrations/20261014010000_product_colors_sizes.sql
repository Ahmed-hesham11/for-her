-- ============================================================================
-- Product colors, optional sizes, and carrying the customer's choice through
-- the cart and into order history.
--
-- Design (all additive; existing products, carts and orders keep working):
--   * product_colors  — one row per color of ONE product. image_url is the
--     color's main image, images[] its additional ones (same convention as
--     products.image_url / products.images). A product is never duplicated
--     per color.
--   * product_sizes   — admin-defined size labels (XS, 40, One Size ...).
--     products.has_sizes is the explicit "does this product have sizes?" switch.
--   * cart_items.color_id / size_id — nullable. A cart line is now unique per
--     (cart, product, color, size).
--   * order_items.color_id / size_id (nullable, ON DELETE SET NULL) plus
--     color_name / size_name SNAPSHOTS, so renaming or deleting an option later
--     never rewrites a past order. The selected color's image URL is stored in
--     the existing order_items.image_url.
--   * No per-color / per-size stock. products.stock_quantity is unchanged.
--
-- Functions:
--   * resolve_item_options  — single place that validates a (product, color,
--     size) selection; used by create_secure_order (and by the cart API).
--   * create_secure_order   — replaced; identical to the previous version
--     (20261008030000) except it validates + snapshots color and size.
--   * admin_save_product_options — replaces a product's colors, sizes and
--     supplier associations in ONE transaction, preserving ids of rows that
--     are kept (so cart lines and order links stay valid).
--
-- Security: product_colors / product_sizes are publicly readable only for
-- ACTIVE products (same rule as products). All writes go through the server's
-- service role. admin_* and resolve_* functions are executable by service_role
-- only. RLS stays enabled everywhere.
--
-- Requires 20261014000000_supplier_products.sql to have been run first.
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists has_sizes boolean not null default false;

create table if not exists public.product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  image_url text,
  images text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_colors_product_id_idx on public.product_colors (product_id, sort_order);

create table if not exists public.product_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 30),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_sizes_product_id_idx on public.product_sizes (product_id, sort_order);

alter table public.product_colors enable row level security;
alter table public.product_sizes enable row level security;

grant select on public.product_colors, public.product_sizes to anon, authenticated;
grant all privileges on public.product_colors, public.product_sizes to service_role;

drop policy if exists "product_colors_public_read" on public.product_colors;
create policy "product_colors_public_read" on public.product_colors
  for select using (exists (select 1 from public.products p where p.id = product_colors.product_id and p.is_active));

drop policy if exists "product_sizes_public_read" on public.product_sizes;
create policy "product_sizes_public_read" on public.product_sizes
  for select using (exists (select 1 from public.products p where p.id = product_sizes.product_id and p.is_active));

-- ---------------------------------------------------------------------------
-- 2. Cart + order items
-- ---------------------------------------------------------------------------
alter table public.cart_items
  add column if not exists color_id uuid references public.product_colors(id) on delete cascade,
  add column if not exists size_id uuid references public.product_sizes(id) on delete cascade;

alter table public.order_items
  add column if not exists color_id uuid references public.product_colors(id) on delete set null,
  add column if not exists color_name text,
  add column if not exists size_id uuid references public.product_sizes(id) on delete set null,
  add column if not exists size_name text;

-- A cart previously held one row per (cart_id, product_id). Drop whichever
-- unique constraint/index enforced that (its name isn't known here) and
-- replace it with one that also distinguishes color and size.
do $$
declare
  r record;
begin
  for r in
    select i.indexrelid, c.conname
      from pg_index i
      left join pg_constraint c on c.conindid = i.indexrelid and c.conrelid = i.indrelid
     where i.indrelid = 'public.cart_items'::regclass
       and i.indisunique
       and not i.indisprimary
       and i.indpred is null
       and i.indexprs is null
       and (
         select array_agg(a.attname::text order by a.attname::text)
           from pg_attribute a
          where a.attrelid = i.indrelid and a.attnum = any (i.indkey)
       ) = array['cart_id', 'product_id']
  loop
    if r.conname is not null then
      execute format('alter table public.cart_items drop constraint %I', r.conname);
    else
      execute format('drop index %s', r.indexrelid::regclass);
    end if;
  end loop;
end $$;

create unique index if not exists cart_items_cart_product_options_key
  on public.cart_items (
    cart_id,
    product_id,
    coalesce(color_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(size_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- ---------------------------------------------------------------------------
-- 3. Validate a color/size selection for a product.
--    Colors: if the product has colors, one must be chosen — except when it
--    has exactly one, which is used automatically. Sizes: required only when
--    products.has_sizes is on and at least one size is defined.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_item_options(
  p_product_id uuid,
  p_color_id uuid,
  p_size_id uuid
)
returns table (r_color_id uuid, r_color_name text, r_color_image_url text, r_size_id uuid, r_size_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  color_count integer;
  size_count integer;
  requires_size boolean;
  v_color product_colors%rowtype;
  v_size product_sizes%rowtype;
begin
  select count(*) into color_count from product_colors pc where pc.product_id = p_product_id;
  if color_count > 0 then
    if p_color_id is null then
      if color_count = 1 then
        select * into v_color from product_colors pc where pc.product_id = p_product_id;
      else
        raise exception using errcode = 'P0001', message = 'COLOR_REQUIRED';
      end if;
    else
      select * into v_color from product_colors pc where pc.id = p_color_id and pc.product_id = p_product_id;
      if not found then
        raise exception using errcode = 'P0001', message = 'INVALID_COLOR';
      end if;
    end if;
  elsif p_color_id is not null then
    raise exception using errcode = 'P0001', message = 'INVALID_COLOR';
  end if;

  select coalesce(p.has_sizes, false) into requires_size from products p where p.id = p_product_id;
  select count(*) into size_count from product_sizes ps where ps.product_id = p_product_id;
  if coalesce(requires_size, false) and size_count > 0 then
    if p_size_id is null then
      raise exception using errcode = 'P0001', message = 'SIZE_REQUIRED';
    end if;
    select * into v_size from product_sizes ps where ps.id = p_size_id and ps.product_id = p_product_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'INVALID_SIZE';
    end if;
  elsif p_size_id is not null then
    raise exception using errcode = 'P0001', message = 'INVALID_SIZE';
  end if;

  return query select v_color.id, v_color.name, v_color.image_url, v_size.id, v_size.label;
end;
$$;

revoke all on function public.resolve_item_options(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_item_options(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. create_secure_order — unchanged from 20261008030000 apart from the
--    color/size validation (first loop) and snapshot columns (second loop).
-- ---------------------------------------------------------------------------
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
    select id, name, sku, selling_price, purchase_price into product_row
      from products where id::text = item->>'product_id' for update;

    select * into option_row from public.resolve_item_options(
      product_row.id,
      nullif(item->>'color_id', '')::uuid,
      nullif(item->>'size_id', '')::uuid
    );

    insert into order_items (
      order_id, product_id, product_name, sku, quantity, unit_price, total_price, unit_cost,
      color_id, color_name, size_id, size_name, image_url
    )
    values (
      order_row.id, product_row.id, product_row.name, product_row.sku,
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

-- ---------------------------------------------------------------------------
-- 5. Save a product's colors, sizes and suppliers atomically.
--    p_colors:    [{ id?, name, image_url, images[] }, ...]   (array order = display order)
--    p_sizes:     [{ id?, label }, ...]
--    p_suppliers: [{ supplier_id, purchase_price, supplier_sku? }, ...]
--    Pass NULL for a section to leave it untouched. Rows whose id is kept are
--    updated in place; rows missing from the payload are deleted (cart lines
--    for them are removed, order history keeps its snapshots).
--    Returns the resulting ids in payload order so the form can keep editing.
-- ---------------------------------------------------------------------------
create or replace function public.admin_save_product_options(
  p_product_id uuid,
  p_has_sizes boolean,
  p_colors jsonb,
  p_sizes jsonb,
  p_suppliers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  el jsonb;
  pos integer;
  new_id uuid;
  existing_id uuid;
  keep_ids uuid[];
  color_ids uuid[] := '{}';
  size_ids uuid[] := '{}';
  v_name text;
  v_price numeric;
begin
  if not exists (select 1 from products where id = p_product_id) then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 1));

  -- Colors ------------------------------------------------------------------
  if p_colors is not null then
    if jsonb_typeof(p_colors) <> 'array' then
      raise exception using errcode = 'P0001', message = 'INVALID_COLORS';
    end if;
    if (select count(distinct lower(btrim(c->>'name'))) from jsonb_array_elements(p_colors) c) <> jsonb_array_length(p_colors) then
      raise exception using errcode = 'P0001', message = 'DUPLICATE_COLOR_NAME';
    end if;

    keep_ids := '{}';
    pos := 0;
    for el in select value from jsonb_array_elements(p_colors)
    loop
      v_name := btrim(coalesce(el->>'name', ''));
      if v_name = '' or char_length(v_name) > 60 then
        raise exception using errcode = 'P0001', message = 'INVALID_COLOR_NAME';
      end if;

      existing_id := null;
      if nullif(el->>'id', '') is not null then
        select id into existing_id from product_colors
         where id = (el->>'id')::uuid and product_id = p_product_id;
      end if;

      if existing_id is not null then
        update product_colors
           set name = v_name,
               image_url = nullif(btrim(coalesce(el->>'image_url', '')), ''),
               images = array(select jsonb_array_elements_text(coalesce(el->'images', '[]'::jsonb))),
               sort_order = pos
         where id = existing_id;
        new_id := existing_id;
      else
        insert into product_colors (product_id, name, image_url, images, sort_order)
        values (
          p_product_id, v_name,
          nullif(btrim(coalesce(el->>'image_url', '')), ''),
          array(select jsonb_array_elements_text(coalesce(el->'images', '[]'::jsonb))),
          pos
        ) returning id into new_id;
      end if;

      keep_ids := keep_ids || new_id;
      color_ids := color_ids || new_id;
      pos := pos + 1;
    end loop;

    delete from product_colors where product_id = p_product_id and not (id = any (keep_ids));
  end if;

  -- Sizes -------------------------------------------------------------------
  if p_has_sizes is not null then
    update products set has_sizes = p_has_sizes where id = p_product_id;
  end if;

  if p_sizes is not null then
    if jsonb_typeof(p_sizes) <> 'array' then
      raise exception using errcode = 'P0001', message = 'INVALID_SIZES';
    end if;
    if coalesce(p_has_sizes, false) and jsonb_array_length(p_sizes) = 0 then
      raise exception using errcode = 'P0001', message = 'SIZES_REQUIRED';
    end if;
    if (select count(distinct lower(btrim(s->>'label'))) from jsonb_array_elements(p_sizes) s) <> jsonb_array_length(p_sizes) then
      raise exception using errcode = 'P0001', message = 'DUPLICATE_SIZE_LABEL';
    end if;

    keep_ids := '{}';
    pos := 0;
    -- "No sizes" saves as zero size rows.
    for el in select value from jsonb_array_elements(case when coalesce(p_has_sizes, false) then p_sizes else '[]'::jsonb end)
    loop
      v_name := btrim(coalesce(el->>'label', ''));
      if v_name = '' or char_length(v_name) > 30 then
        raise exception using errcode = 'P0001', message = 'INVALID_SIZE_LABEL';
      end if;

      existing_id := null;
      if nullif(el->>'id', '') is not null then
        select id into existing_id from product_sizes
         where id = (el->>'id')::uuid and product_id = p_product_id;
      end if;

      if existing_id is not null then
        update product_sizes set label = v_name, sort_order = pos where id = existing_id;
        new_id := existing_id;
      else
        insert into product_sizes (product_id, label, sort_order)
        values (p_product_id, v_name, pos) returning id into new_id;
      end if;

      keep_ids := keep_ids || new_id;
      size_ids := size_ids || new_id;
      pos := pos + 1;
    end loop;

    delete from product_sizes where product_id = p_product_id and not (id = any (keep_ids));
  end if;

  -- Suppliers ---------------------------------------------------------------
  if p_suppliers is not null then
    if jsonb_typeof(p_suppliers) <> 'array' then
      raise exception using errcode = 'P0001', message = 'INVALID_SUPPLIERS';
    end if;
    if (select count(distinct s->>'supplier_id') from jsonb_array_elements(p_suppliers) s) <> jsonb_array_length(p_suppliers) then
      raise exception using errcode = 'P0001', message = 'DUPLICATE_SUPPLIER';
    end if;

    keep_ids := '{}';
    for el in select value from jsonb_array_elements(p_suppliers)
    loop
      if not exists (select 1 from suppliers where id::text = el->>'supplier_id') then
        raise exception using errcode = 'P0001', message = 'INVALID_SUPPLIER';
      end if;
      v_price := (el->>'purchase_price')::numeric;
      if v_price is null or v_price < 0 or v_price >= 10000000000 then
        raise exception using errcode = 'P0001', message = 'INVALID_PURCHASE_PRICE';
      end if;

      insert into supplier_products (supplier_id, product_id, purchase_price, supplier_sku)
      values (
        (el->>'supplier_id')::uuid, p_product_id, round(v_price, 2),
        nullif(btrim(coalesce(el->>'supplier_sku', '')), '')
      )
      on conflict (supplier_id, product_id) do update
        set purchase_price = excluded.purchase_price,
            supplier_sku = excluded.supplier_sku;

      keep_ids := keep_ids || (el->>'supplier_id')::uuid;
    end loop;

    -- Only the association goes; the supplier and any purchase history stay.
    delete from supplier_products where product_id = p_product_id and not (supplier_id = any (keep_ids));
  end if;

  return jsonb_build_object('color_ids', to_jsonb(color_ids), 'size_ids', to_jsonb(size_ids));
end;
$$;

revoke all on function public.admin_save_product_options(uuid, boolean, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_product_options(uuid, boolean, jsonb, jsonb, jsonb) to service_role;
