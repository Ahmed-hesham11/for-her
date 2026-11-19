-- admin_revenue_profit_by_range used to aggregate EVERY row of order_items on
-- each dashboard load (the cost subquery wasn't limited to the requested
-- dates), which gets slower with every order and can time out (504). Same
-- result, but the cost is now only computed for orders inside the range.
create or replace function public.admin_revenue_profit_by_range(
  p_from date default current_date - 13,
  p_to date default current_date
)
returns table(day date, revenue numeric, cost numeric, profit numeric, orders_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    d::date as day,
    coalesce(sum(o.total_amount), 0) as revenue,
    coalesce(sum(items.cost), 0) as cost,
    coalesce(sum(o.total_amount), 0) - coalesce(sum(items.cost), 0) as profit,
    count(distinct o.id) as orders_count
  from generate_series(least(p_from, p_to), greatest(p_from, p_to), interval '1 day') d
  left join orders o on o.created_at::date = d::date and o.status <> 'cancelled'
  left join (
    select oi.order_id, sum(coalesce(oi.unit_cost, 0) * oi.quantity) as cost
    from order_items oi
    join orders oo on oo.id = oi.order_id
    where oo.created_at >= least(p_from, p_to)::timestamptz - interval '1 day'
      and oo.created_at < greatest(p_from, p_to)::timestamptz + interval '2 days'
    group by oi.order_id
  ) items on items.order_id = o.id
  where public.is_admin()
  group by d
  order by d;
$$;

create index if not exists orders_created_at_idx on public.orders (created_at);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

revoke all on function public.admin_revenue_profit_by_range(date, date) from public, anon, authenticated;
grant execute on function public.admin_revenue_profit_by_range(date, date) to service_role;
