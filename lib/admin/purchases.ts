import type { SupabaseClient } from "@supabase/supabase-js";

export const PURCHASE_STATUSES = ["pending", "received", "cancelled"] as const;

export type AdminPurchaseListItem = {
  id: string;
  purchase_number: number | null;
  purchase_date: string;
  supplier_name: string;
  total_amount: number;
  status: string;
  created_at: string;
};

export type AdminPurchaseDetail = AdminPurchaseListItem & {
  supplier_id: string;
  notes: string | null;
};

export type AdminPurchaseItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
};

type PurchaseRow = {
  id: string;
  supplier_id: string;
  purchase_number: number | null;
  purchase_date: string;
  total_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  suppliers: { name: string } | { name: string }[] | null;
};

function firstOrNull<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const PURCHASE_SELECT = "id, supplier_id, purchase_number, purchase_date, total_amount, status, notes, created_at, suppliers(name)";

export async function getAdminPurchases(
  supabase: SupabaseClient,
  params: { status?: string; page?: number; pageSize?: number } = {},
): Promise<{ purchases: AdminPurchaseListItem[]; total: number; page: number; pageSize: number; error: string | null }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 20;

  let query = supabase.from("purchases").select(PURCHASE_SELECT, { count: "exact" });
  if (params.status) query = query.eq("status", params.status);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) return { purchases: [], total: 0, page, pageSize, error: error.message };

  const purchases = ((data ?? []) as unknown as PurchaseRow[]).map((row) => ({
    id: row.id,
    purchase_number: row.purchase_number,
    purchase_date: row.purchase_date,
    supplier_name: firstOrNull(row.suppliers)?.name ?? "Unknown supplier",
    total_amount: Number(row.total_amount),
    status: row.status,
    created_at: row.created_at,
  }));

  return { purchases, total: count ?? 0, page, pageSize, error: null };
}

export async function getAdminPurchaseById(supabase: SupabaseClient, id: string): Promise<{ purchase: AdminPurchaseDetail; items: AdminPurchaseItem[] } | null> {
  const { data, error } = await supabase.from("purchases").select(PURCHASE_SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as PurchaseRow;
  const purchase: AdminPurchaseDetail = {
    id: row.id,
    supplier_id: row.supplier_id,
    purchase_number: row.purchase_number,
    purchase_date: row.purchase_date,
    supplier_name: firstOrNull(row.suppliers)?.name ?? "Unknown supplier",
    total_amount: Number(row.total_amount),
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
  };

  const { data: items } = await supabase
    .from("purchase_items")
    .select("id, product_id, quantity, unit_cost, total_cost, products(name)")
    .eq("purchase_id", id);

  const mappedItems = ((items ?? []) as unknown as { id: string; product_id: string; quantity: number; unit_cost: number; total_cost: number; products: { name: string } | { name: string }[] | null }[]).map((item) => ({
    id: item.id,
    product_id: item.product_id,
    product_name: firstOrNull(item.products)?.name ?? "Unknown product",
    quantity: Number(item.quantity),
    unit_cost: Number(item.unit_cost),
    total_cost: Number(item.total_cost),
  }));

  return { purchase, items: mappedItems };
}

export type NewPurchaseItem = { product_id: string; quantity: number; unit_cost: number };

export async function createPurchase(
  supabase: SupabaseClient,
  input: { supplier_id: string; purchase_date: string; notes: string; items: NewPurchaseItem[] },
): Promise<{ id: string | null; error: string | null }> {
  if (!input.supplier_id) return { id: null, error: "Supplier is required." };
  if (input.items.length === 0) return { id: null, error: "Add at least one product line." };
  if (input.items.some((item) => !item.product_id || item.quantity < 1 || item.unit_cost < 0)) {
    return { id: null, error: "Each line needs a product, a quantity of at least 1, and a non-negative unit cost." };
  }

  const { data, error } = await supabase.rpc("admin_create_purchase", {
    p_supplier_id: input.supplier_id,
    p_purchase_date: input.purchase_date,
    p_notes: input.notes,
    p_items: input.items,
  });

  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}
