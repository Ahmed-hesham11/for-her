-- ============================================================================
-- PHASE 5: admin access for the remaining dashboard modules —
-- Suppliers (already granted in 20260905000000, unaffected here),
-- Purchases/purchase_items, Coupons, and Customers (via two RPCs that read
-- auth.users.email safely, without a service-role key).
--
-- Orders/order_items need NO new policy — Phase 4's `orders_admin_all`
-- already grants admin full select/insert/update/delete, which covers the
-- Orders module's list, detail, and status-change actions.
--
-- IMPORTANT CAVEAT on the two customer RPCs below: they read `auth.users`
-- from inside a SECURITY DEFINER function. This is a well-established
-- Supabase pattern (the function owner — typically `postgres` when created
-- via the SQL editor — has SELECT on auth.users where the anon/authenticated
-- roles do not), but I cannot verify from here whether it holds on your
-- specific project. If running this errors with something like "permission
-- denied for schema auth" or "relation auth.users does not exist", report
-- the exact error back — the fix is a one-line grant, not a redesign.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved anywhere in this file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Purchases & purchase_items: admin-only (mirrors suppliers_admin_all).
-- ----------------------------------------------------------------------------
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

grant select, insert, update, delete on public.purchases, public.purchase_items to authenticated;

drop policy if exists "purchases_admin_all" on public.purchases;
create policy "purchases_admin_all" on public.purchases
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "purchase_items_admin_all" on public.purchase_items;
create policy "purchase_items_admin_all" on public.purchase_items
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. Coupons: enable RLS (currently disabled), admin gets full read/write.
--    Note: this does NOT affect checkout — calculate_order_quote and
--    create_secure_order are SECURITY DEFINER (Phase 3) and already bypass
--    RLS for their internal coupon lookups regardless of this policy.
-- ----------------------------------------------------------------------------
alter table public.coupons enable row level security;

grant select, insert, update, delete on public.coupons to authenticated;

drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. Customers: list + detail, including email (lives in auth.users, not
--    profiles). SECURITY DEFINER + explicit is_admin() check, same pattern
--    as the dashboard's other reporting functions.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_customers(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table(
  id uuid,
  full_name text,
  email text,
  phone_1 text,
  governorate text,
  created_at timestamptz,
  order_count bigint,
  total_spent numeric,
  total_count bigint
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
    p.id, p.full_name, u.email::text, p.phone_1, p.governorate, p.created_at,
    coalesce(stats.order_count, 0) as order_count,
    coalesce(stats.total_spent, 0) as total_spent,
    count(*) over() as total_count
  from public.profiles p
  join auth.users u on u.id = p.id
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
      or u.email ilike '%' || p_search || '%'
    )
  order by p.created_at desc
  limit greatest(p_page_size, 1)
  offset greatest(p_page - 1, 0) * greatest(p_page_size, 1);
end;
$$;

create or replace function public.admin_customer_detail(p_user_id uuid)
returns table(
  id uuid,
  full_name text,
  email text,
  phone_1 text,
  phone_2 text,
  governorate text,
  address text,
  created_at timestamptz,
  order_count bigint,
  total_spent numeric
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
    p.id, p.full_name, u.email::text, p.phone_1, p.phone_2, p.governorate, p.address, p.created_at,
    coalesce(stats.order_count, 0) as order_count,
    coalesce(stats.total_spent, 0) as total_spent
  from public.profiles p
  join auth.users u on u.id = p.id
  left join (
    select o.user_id, count(*) as order_count, sum(o.total_amount) as total_spent
    from public.orders o
    where o.user_id = p_user_id and o.status <> 'cancelled'
    group by o.user_id
  ) stats on stats.user_id = p.id
  where p.id = p_user_id;
end;
$$;

revoke all on function public.admin_list_customers(text, integer, integer) from public;
revoke all on function public.admin_customer_detail(uuid) from public;
grant execute on function public.admin_list_customers(text, integer, integer) to authenticated;
grant execute on function public.admin_customer_detail(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Create a purchase (header + line items) atomically. Direct sequential
--    client-side inserts (create purchase, then insert items) would leave an
--    orphaned purchase header if the items insert failed partway — this RPC
--    does both in one transaction, in a single function call.
--    p_items shape: [{ "product_id": uuid, "quantity": int, "unit_cost": numeric }, ...]
-- ----------------------------------------------------------------------------
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
  values (p_supplier_id, p_purchase_date, total_amount, 'pending', nullif(trim(p_notes), ''))
  returning id into purchase_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    quantity := (item->>'quantity')::integer;
    unit_cost := (item->>'unit_cost')::numeric;

    insert into purchase_items (purchase_id, product_id, quantity, unit_cost, total_cost)
    values (purchase_id, (item->>'product_id')::uuid, quantity, unit_cost, quantity * unit_cost);
  end loop;

  return purchase_id;
end;
$$;

revoke all on function public.admin_create_purchase(uuid, date, text, jsonb) from public;
grant execute on function public.admin_create_purchase(uuid, date, text, jsonb) to authenticated;
