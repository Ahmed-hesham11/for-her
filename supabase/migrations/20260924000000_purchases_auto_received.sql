-- ============================================================================
-- Purchases no longer go through a manual "pending -> received" status step.
-- The admin UI's status selector on the purchase detail page is removed, so
-- there is no way left to trigger admin_update_purchase_status("received")
-- after the fact — stock would never be credited. Instead, admin_create_purchase
-- now credits each line's quantity to products.stock_quantity immediately and
-- inserts the purchase already as 'received', matching what happened before
-- only after an admin manually flipped the status.
--
-- The product form's manual "purchase price" field is also removed —
-- products.purchase_price is now read-only from the admin's point of view
-- and is instead set here, to each line's unit_cost, every time a purchase
-- is created. (Last cost paid wins when a product is repurchased at a
-- different price; there's no separate averaging.)
--
-- admin_update_purchase_status (and the 'pending'/'cancelled' statuses) are
-- left in place for any existing rows created before this migration — this
-- only changes what admin_create_purchase does going forward.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

create or replace function public.admin_create_purchase(
  p_supplier_id uuid,
  p_purchase_date date,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  product_row record;
  purchase_id uuid;
  quantity integer;
  unit_cost numeric(12, 2);
  total_amount numeric(12, 2) := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_ONLY';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_ITEMS';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    quantity := (item->>'quantity')::integer;
    unit_cost := (item->>'unit_cost')::numeric;
    if quantity is null or quantity < 1 then
      raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
    end if;
    if unit_cost is null or unit_cost < 0 then
      raise exception using errcode = 'P0001', message = 'INVALID_UNIT_COST';
    end if;

    select id into product_row from products where id::text = item->>'product_id';
    if not found then
      raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
    end if;

    total_amount := total_amount + (quantity * unit_cost);
  end loop;

  insert into purchases (supplier_id, purchase_date, total_amount, status, notes)
  values (p_supplier_id, p_purchase_date, total_amount, 'received', nullif(trim(p_notes), ''))
  returning id into purchase_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    quantity := (item->>'quantity')::integer;
    unit_cost := (item->>'unit_cost')::numeric;

    insert into purchase_items (purchase_id, product_id, quantity, unit_cost, total_cost)
    values (purchase_id, (item->>'product_id')::uuid, quantity, unit_cost, quantity * unit_cost);

    update products set stock_quantity = stock_quantity + quantity, purchase_price = unit_cost where id = (item->>'product_id')::uuid;
  end loop;

  return purchase_id;
end;
$$;

revoke all on function public.admin_create_purchase(uuid, date, text, jsonb) from public;
grant execute on function public.admin_create_purchase(uuid, date, text, jsonb) to authenticated;
