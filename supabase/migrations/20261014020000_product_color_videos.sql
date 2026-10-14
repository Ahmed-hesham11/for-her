-- ============================================================================
-- Videos per color. product_colors.videos is a text[] of public URLs (same
-- shape as products.videos); the storefront product page shows a color's
-- videos in its gallery when that color is selected.
--
-- Also re-creates admin_save_product_options (from 20261014010000) so it saves
-- the new videos field; otherwise identical.
--
-- Run AFTER 20261014010000_product_colors_sizes.sql.
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

alter table public.product_colors add column if not exists videos text[] not null default '{}';

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
               videos = array(select jsonb_array_elements_text(coalesce(el->'videos', '[]'::jsonb))),
               sort_order = pos
         where id = existing_id;
        new_id := existing_id;
      else
        insert into product_colors (product_id, name, image_url, images, videos, sort_order)
        values (
          p_product_id, v_name,
          nullif(btrim(coalesce(el->>'image_url', '')), ''),
          array(select jsonb_array_elements_text(coalesce(el->'images', '[]'::jsonb))),
          array(select jsonb_array_elements_text(coalesce(el->'videos', '[]'::jsonb))),
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
