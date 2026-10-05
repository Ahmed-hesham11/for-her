import type { SupabaseClient } from "@supabase/supabase-js";

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export type AdminKpis = {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  pendingOrders: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  activeProducts: number;
};

export type RevenueSummary = {
  today: number;
  last7Days: number;
  last30Days: number;
};

export type RevenueProfitDay = { day: string; revenue: number; cost: number; profit: number; ordersCount: number };

export type RangeTotals = { revenue: number; cost: number; profit: number; ordersCount: number };

export type RecentOrder = {
  id: string;
  order_number: number | null;
  customer_name: string;
  created_at: string;
  total_amount: number;
  payment_status: string;
  status: string;
};

export type OrderStatusCount = { status: OrderStatus; count: number };

export type LowStockProduct = {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
};

export type TopSellingProduct = {
  product_id: string;
  product_name: string;
  sku: string | null;
  units_sold: number;
  revenue: number;
};

export type DashboardOverview = {
  kpis: AdminKpis;
  revenueSummary: RevenueSummary;
  revenueProfitByDay: RevenueProfitDay[];
  rangeTotals: RangeTotals;
  range: { from: string; to: string };
  recentOrders: RecentOrder[];
  orderStatusCounts: OrderStatusCount[];
  lowStockProducts: LowStockProduct[];
  topSellingProducts: TopSellingProduct[];
  errors: string[];
};

const ORDER_STATUSES: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled"];

function count(value: number | null) {
  return value ?? 0;
}

function trackError(errors: string[] | undefined, context: string, error: { message: string } | null) {
  if (!error) return;
  console.error(`[admin/data] ${context} failed:`, error.message);
  errors?.push(`${context}: ${error.message}`);
}

export async function getAdminKpis(supabase: SupabaseClient, errors?: string[]): Promise<AdminKpis> {
  // Not head:true — a HEAD response has no body, so when a query fails
  // (e.g. a missing RLS grant) PostgREST can't return an error message and
  // trackError below silently gets `error.message === ""`. A normal request
  // costs a little more (the `id` column comes back too) but keeps failures
  // diagnosable, which matters far more on a low-traffic admin dashboard.
  const [stock, totalOrders, pendingOrders, totalCustomers] = await Promise.all([
    supabase.rpc("admin_stock_summary"),
    supabase.from("orders").select("id", { count: "exact" }),
    supabase.from("orders").select("id", { count: "exact" }).eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact" }).eq("role", "customer"),
  ]);

  trackError(errors, "Stock summary", stock.error);
  trackError(errors, "Total orders count", totalOrders.error);
  trackError(errors, "Pending orders count", pendingOrders.error);
  trackError(errors, "Total customers count", totalCustomers.error);

  const stockData = stock.data as { total?: number; active?: number; out_of_stock?: number; low_stock?: number } | null;

  return {
    totalRevenue: 0,
    totalOrders: count(totalOrders.count),
    totalCustomers: count(totalCustomers.count),
    totalProducts: Number(stockData?.total ?? 0),
    pendingOrders: count(pendingOrders.count),
    activeProducts: Number(stockData?.active ?? 0),
    outOfStockProducts: Number(stockData?.out_of_stock ?? 0),
    lowStockProducts: Number(stockData?.low_stock ?? 0),
  };
}

export async function getRevenueSummary(supabase: SupabaseClient, errors?: string[]): Promise<RevenueSummary> {
  const { data, error } = await supabase.rpc("admin_revenue_summary");
  trackError(errors, "Revenue summary", error);
  const result = data as { today?: number; last_7_days?: number; last_30_days?: number } | null;

  return {
    today: Number(result?.today ?? 0),
    last7Days: Number(result?.last_7_days ?? 0),
    last30Days: Number(result?.last_30_days ?? 0),
  };
}

export async function getRevenueProfitByRange(supabase: SupabaseClient, from: string, to: string, errors?: string[]): Promise<RevenueProfitDay[]> {
  const { data, error } = await supabase.rpc("admin_revenue_profit_by_range", { p_from: from, p_to: to });
  trackError(errors, "Revenue & profit by range", error);
  return ((data ?? []) as { day: string; revenue: number; cost: number; profit: number; orders_count: number }[]).map((row) => ({
    day: row.day,
    revenue: Number(row.revenue),
    cost: Number(row.cost),
    profit: Number(row.profit),
    ordersCount: Number(row.orders_count),
  }));
}

export async function getRecentOrders(supabase: SupabaseClient, limit = 8, errors?: string[]): Promise<RecentOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, created_at, total_amount, payment_status, status")
    .order("created_at", { ascending: false })
    .limit(limit);

  trackError(errors, "Recent orders", error);
  return (data ?? []) as RecentOrder[];
}

export async function getOrderStatusCounts(supabase: SupabaseClient, errors?: string[]): Promise<OrderStatusCount[]> {
  const { data, error } = await supabase.rpc("admin_order_status_counts");
  trackError(errors, "Order status counts", error);
  const counts = new Map(((data ?? []) as { status: string; count: number }[]).map((row) => [row.status, Number(row.count)]));

  return ORDER_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

export async function getLowStockProducts(supabase: SupabaseClient, limit = 8, errors?: string[]): Promise<LowStockProduct[]> {
  const { data, error } = await supabase.rpc("admin_low_stock_products", { limit_count: limit });
  trackError(errors, "Low stock products", error);
  return (data ?? []) as LowStockProduct[];
}

export async function getTopSellingProducts(supabase: SupabaseClient, limit = 5, errors?: string[]): Promise<TopSellingProduct[]> {
  const { data, error } = await supabase.rpc("admin_top_selling_products", { limit_count: limit });
  trackError(errors, "Top selling products", error);
  return ((data ?? []) as { product_id: string; product_name: string; sku: string | null; units_sold: number; revenue: number }[]).map((row) => ({
    ...row,
    units_sold: Number(row.units_sold),
    revenue: Number(row.revenue),
  }));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Mirrors admin_revenue_profit_by_range's own defaults (today, and 13 days
// before it) so "no filter applied" looks identical to the old fixed
// 14-day chart.
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 13);
  return { from: isoDate(from), to: isoDate(to) };
}

export async function getDashboardOverview(supabase: SupabaseClient, range?: { from?: string; to?: string }): Promise<DashboardOverview> {
  const errors: string[] = [];
  const defaults = defaultRange();
  const resolvedRange = { from: range?.from || defaults.from, to: range?.to || defaults.to };

  const [kpis, revenueSummary, revenueProfitByDay, recentOrders, orderStatusCounts, lowStockProducts, topSellingProducts] = await Promise.all([
    getAdminKpis(supabase, errors),
    getRevenueSummary(supabase, errors),
    getRevenueProfitByRange(supabase, resolvedRange.from, resolvedRange.to, errors),
    getRecentOrders(supabase, 8, errors),
    getOrderStatusCounts(supabase, errors),
    getLowStockProducts(supabase, 8, errors),
    getTopSellingProducts(supabase, 5, errors),
  ]);

  const rangeTotals = revenueProfitByDay.reduce<RangeTotals>(
    (totals, day) => ({
      revenue: totals.revenue + day.revenue,
      cost: totals.cost + day.cost,
      profit: totals.profit + day.profit,
      ordersCount: totals.ordersCount + day.ordersCount,
    }),
    { revenue: 0, cost: 0, profit: 0, ordersCount: 0 },
  );

  return {
    kpis: { ...kpis, totalRevenue: revenueSummary.last30Days },
    revenueSummary,
    revenueProfitByDay,
    rangeTotals,
    range: resolvedRange,
    recentOrders,
    orderStatusCounts,
    lowStockProducts,
    topSellingProducts,
    errors,
  };
}
