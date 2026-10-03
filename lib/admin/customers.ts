import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminCustomer = {
  id: string;
  full_name: string;
  email: string;
  phone_1: string;
  governorate: string;
  created_at: string;
  order_count: number;
  total_spent: number;
};

export type AdminCustomerDetail = Omit<AdminCustomer, "governorate"> & {
  phone_2: string | null;
  governorate: string;
  address: string;
};

export type CustomerOrderSummary = {
  id: string;
  order_number: number | null;
  created_at: string;
  total_amount: number;
  status: string;
  payment_status: string;
};

export async function getAdminCustomers(
  supabase: SupabaseClient,
  params: { search?: string; page?: number; pageSize?: number } = {},
): Promise<{ customers: AdminCustomer[]; total: number; page: number; pageSize: number; error: string | null }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 20;

  const { data, error } = await supabase.rpc("admin_list_customers", {
    p_search: params.search?.trim() || null,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) return { customers: [], total: 0, page, pageSize, error: error.message };

  const rows = (data ?? []) as (AdminCustomer & { total_count: number })[];
  const total = rows[0]?.total_count ?? 0;

  return {
    customers: rows.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      phone_1: row.phone_1,
      governorate: row.governorate,
      created_at: row.created_at,
      order_count: Number(row.order_count),
      total_spent: Number(row.total_spent),
    })),
    total: Number(total),
    page,
    pageSize,
    error: null,
  };
}

export async function getAdminCustomerDetail(supabase: SupabaseClient, id: string): Promise<AdminCustomerDetail | null> {
  const { data, error } = await supabase.rpc("admin_customer_detail", { p_user_id: id }).maybeSingle();
  if (error || !data) return null;

  const row = data as AdminCustomerDetail;
  return { ...row, order_count: Number(row.order_count), total_spent: Number(row.total_spent) };
}

export async function getCustomerOrders(supabase: SupabaseClient, userId: string): Promise<CustomerOrderSummary[]> {
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, created_at, total_amount, status, payment_status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (data ?? []) as CustomerOrderSummary[];
}
