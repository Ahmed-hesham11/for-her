import type { SupabaseClient } from "@supabase/supabase-js";

export const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;

export type AdminOrderListItem = {
  id: string;
  order_number: number | null;
  customer_name: string;
  phone_1: string;
  governorate: string;
  created_at: string;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  confirmed: boolean;
  printed: boolean;
  source: string;
  item_count: number;
};

export type AdminOrderDetail = AdminOrderListItem & {
  user_id: string;
  phone_2: string | null;
  address: string;
  notes: string | null;
};

export type AdminOrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url: string | null;
};

export type OrderListParams = {
  search?: string;
  status?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type OrderListResult = {
  orders: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  error: string | null;
};

const ORDER_SELECT = "id, order_number, customer_name, phone_1, governorate, created_at, subtotal, discount, shipping_fee, total_amount, payment_method, payment_status, status, confirmed, printed, source";

export async function getAdminOrders(supabase: SupabaseClient, params: OrderListParams = {}): Promise<OrderListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 20;

  let query = supabase.from("orders").select(ORDER_SELECT, { count: "exact" });

  if (params.search) {
    const term = params.search.trim();
    if (term) {
      const numeric = Number(term);
      if (Number.isInteger(numeric)) {
        query = query.or(`customer_name.ilike.%${term}%,phone_1.ilike.%${term}%,order_number.eq.${numeric}`);
      } else {
        query = query.or(`customer_name.ilike.%${term}%,phone_1.ilike.%${term}%`);
      }
    }
  }
  if (params.status) query = query.eq("status", params.status);
  if (params.paymentStatus) query = query.eq("payment_status", params.paymentStatus);
  if (params.dateFrom) query = query.gte("created_at", params.dateFrom);
  if (params.dateTo) query = query.lte("created_at", `${params.dateTo}T23:59:59`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.order("created_at", { ascending: params.sortDir === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) return { orders: [], total: 0, page, pageSize, error: error.message };

  const orders = (data ?? []) as unknown as AdminOrderListItem[];
  const orderIds = orders.map((order) => order.id);

  const itemCounts = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: itemRows } = await supabase.from("order_items").select("order_id").in("order_id", orderIds);
    for (const row of (itemRows ?? []) as { order_id: string }[]) {
      itemCounts.set(row.order_id, (itemCounts.get(row.order_id) ?? 0) + 1);
    }
  }

  return {
    orders: orders.map((order) => ({ ...order, item_count: itemCounts.get(order.id) ?? 0 })),
    total: count ?? 0,
    page,
    pageSize,
    error: null,
  };
}

export async function getAdminOrderById(supabase: SupabaseClient, id: string): Promise<{ order: AdminOrderDetail; items: AdminOrderItem[] } | null> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, user_id, order_number, customer_name, phone_1, phone_2, governorate, address, created_at, subtotal, discount, shipping_fee, total_amount, payment_method, payment_status, status, confirmed, printed, source, notes")
    .eq("id", id)
    .maybeSingle();

  if (error || !order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_id, product_name, sku, quantity, unit_price, total_price, products(image_url)")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const mappedItems = ((items ?? []) as unknown as (Omit<AdminOrderItem, "image_url"> & { products: { image_url: string | null } | { image_url: string | null }[] | null })[]).map((item) => {
    const product = Array.isArray(item.products) ? (item.products[0] ?? null) : item.products;
    return { ...item, image_url: product?.image_url ?? null };
  });

  // Older rows created before the request_id column existed may still carry
  // create_secure_order's checkout idempotency marker in notes — never a
  // real customer note, so it's never worth showing here.
  const notes = order.notes?.startsWith("checkout-request:") ? null : order.notes;

  return { order: { ...order, notes, item_count: mappedItems.length } as AdminOrderDetail, items: mappedItems };
}

// Backs the bulk print page (/admin/orders/print?ids=...) — one call per
// selected order is simple and fine at this store's order volume; results
// come back in the same order as the requested ids (missing/invalid ids are
// just dropped) so the printed sheets match what the admin selected.
export async function getAdminOrdersByIds(supabase: SupabaseClient, ids: string[]): Promise<{ order: AdminOrderDetail; items: AdminOrderItem[] }[]> {
  const results = await Promise.all(ids.map((id) => getAdminOrderById(supabase, id)));
  return results.filter((result): result is { order: AdminOrderDetail; items: AdminOrderItem[] } => result !== null);
}

export async function updateOrderStatus(supabase: SupabaseClient, id: string, status: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function updatePaymentStatus(supabase: SupabaseClient, id: string, paymentStatus: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("orders").update({ payment_status: paymentStatus }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function updateOrderConfirmed(supabase: SupabaseClient, id: string, confirmed: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from("orders").update({ confirmed }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function updateOrderPrinted(supabase: SupabaseClient, id: string, printed: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from("orders").update({ printed }).eq("id", id);
  return { error: error?.message ?? null };
}

export type NewManualOrderItem = { product_id: string; quantity: number };

export type ManualOrderInput = {
  customer_name: string;
  phone_1: string;
  phone_2: string;
  governorate: string;
  address: string;
  payment_method: string;
  notes: string;
  discount: number;
  items: NewManualOrderItem[];
};

// Logs an order that came in through DMs/comments on social media rather
// than the storefront checkout — same effect as create_secure_order
// (deducts stock, becomes a real order the rest of the admin — dashboard,
// WhatsApp confirm, print invoice, status — treats identically), just
// entered by the admin instead of run by the customer through cart/checkout.
// There's no authenticated customer behind it, so user_id is left null and
// `source` is set to 'social' to distinguish it in the orders list.
export async function createManualOrder(supabase: SupabaseClient, input: ManualOrderInput): Promise<{ id: string | null; error: string | null }> {
  if (!input.customer_name.trim()) return { id: null, error: "اسم العميل مطلوب." };
  if (!input.phone_1.trim()) return { id: null, error: "رقم الهاتف مطلوب." };
  if (!input.governorate) return { id: null, error: "المحافظة مطلوبة." };
  if (input.items.length === 0) return { id: null, error: "أضف منتجًا واحدًا على الأقل." };
  if (input.items.some((item) => !item.product_id || item.quantity < 1)) {
    return { id: null, error: "كل سطر يحتاج منتج وكمية 1 على الأقل." };
  }

  const { data, error } = await supabase.rpc("admin_create_manual_order", {
    p_customer_name: input.customer_name,
    p_phone_1: input.phone_1,
    p_phone_2: input.phone_2 || null,
    p_governorate: input.governorate,
    p_address: input.address,
    p_payment_method: input.payment_method,
    p_notes: input.notes,
    p_discount: input.discount,
    p_items: input.items,
  });

  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}
