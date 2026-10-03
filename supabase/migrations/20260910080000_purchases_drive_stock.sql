-- ============================================================================
-- Make Purchases the source of truth for stock increases.
--
-- The Product form no longer lets an admin type a stock number directly —
-- a new product starts at 0, and from then on stock_quantity is only ever
-- changed by: (a) this function, when a purchase is marked "received", and
-- (b) create_secure_order, when a customer places an order (unchanged).
--
-- admin_update_purchase_status replaces the previous plain
-- `update purchases set status = ...` used by the Purchases status select.
-- It is idempotent with respect to status flips: moving INTO 'received' adds
-- each purchase_items line's quantity to the matching product's stock;
-- moving OUT of 'received' (correcting a mistake) removes it again, floored
-- at 0. Re-marking 'received' -> 'received' (or any other no-op transition)
-- changes nothing, so toggling the status repeatedly cannot double-count.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

create or replace function public.admin_update_purchase_status(
  p_purchase_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase_row record;
  item record;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_ONLY';
  end if;
  if p_status not in ('pending', 'received', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS';
  end if;

  select id, status into purchase_row from purchases where id = p_purchase_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PURCHASE_NOT_FOUND';
  end if;

  if purchase_row.status = p_status then
    return;
  end if;

  if p_status = 'received' and purchase_row.status <> 'received' then
    for item in select product_id, quantity from purchase_items where purchase_id = p_purchase_id loop
      update products set stock_quantity = stock_quantity + item.quantity where id = item.product_id;
    end loop;
  end if;

  if purchase_row.status = 'received' and p_status <> 'received' then
    for item in select product_id, quantity from purchase_items where purchase_id = p_purchase_id loop
      update products set stock_quantity = greatest(stock_quantity - item.quantity, 0) where id = item.product_id;
    end loop;
  end if;

  update purchases set status = p_status where id = p_purchase_id;
end;
$$;

revoke all on function public.admin_update_purchase_status(uuid, text) from public;
grant execute on function public.admin_update_purchase_status(uuid, text) to authenticated;
