-- ============================================================================
-- "Low stock" is now a single fixed threshold (5) shared by every product,
-- instead of a per-product minimum_stock value editable on the product form
-- (that field is removed from the admin UI). admin_stock_summary and
-- admin_low_stock_products are updated to compare against the constant 5
-- instead of products.minimum_stock. The products.minimum_stock column
-- itself is left in place (unused) — dropping it isn't necessary for this.
--
-- admin_low_stock_products' return columns change (minimum_stock removed),
-- so the function must be dropped and recreated rather than replaced.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

create or replace function public.admin_stock_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_ONLY';
  end if;

  return jsonb_build_object(
    'total', (select count(*) from products),
    'active', (select count(*) from products where is_active),
    'out_of_stock', (select count(*) from products where stock_quantity <= 0),
    'low_stock', (select count(*) from products where stock_quantity > 0 and stock_quantity <= 5)
  );
end;
$$;

drop function if exists public.admin_low_stock_products(integer);

create function public.admin_low_stock_products(limit_count integer default 20)
returns table(id uuid, name text, sku text, stock_quantity integer)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.sku, p.stock_quantity
  from products p
  where public.is_admin() and p.stock_quantity <= 5
  order by p.stock_quantity asc
  limit greatest(limit_count, 1);
$$;

revoke all on function public.admin_stock_summary() from public;
revoke all on function public.admin_low_stock_products(integer) from public;
grant execute on function public.admin_stock_summary() to authenticated;
grant execute on function public.admin_low_stock_products(integer) to authenticated;
