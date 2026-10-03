import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminCoupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

export type CouponInput = {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  expires_at: string | null;
  is_active: boolean;
};

export function validateCoupon(input: CouponInput): string | null {
  if (!input.code.trim()) return "Coupon code is required.";
  if (!Number.isFinite(input.discount_value) || input.discount_value <= 0) return "Discount value must be greater than 0.";
  if (input.discount_type === "percentage" && input.discount_value > 100) return "Percentage discount cannot exceed 100.";
  if (input.min_order_amount !== null && input.min_order_amount < 0) return "Minimum order amount must be 0 or greater.";
  if (input.max_uses !== null && (!Number.isInteger(input.max_uses) || input.max_uses < 1)) return "Max uses must be a whole number of 1 or more.";
  return null;
}

export async function getAdminCoupons(supabase: SupabaseClient, search?: string): Promise<{ coupons: AdminCoupon[]; error: string | null }> {
  let query = supabase.from("coupons").select("id, code, discount_type, discount_value, min_order_amount, max_uses, used_count, expires_at, is_active, created_at").order("created_at", { ascending: false });

  if (search?.trim()) {
    query = query.ilike("code", `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) return { coupons: [], error: error.message };
  return { coupons: (data ?? []) as AdminCoupon[], error: null };
}

export async function getAdminCouponById(supabase: SupabaseClient, id: string): Promise<AdminCoupon | null> {
  const { data, error } = await supabase.from("coupons").select("id, code, discount_type, discount_value, min_order_amount, max_uses, used_count, expires_at, is_active, created_at").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as AdminCoupon;
}

export async function createCoupon(supabase: SupabaseClient, input: CouponInput): Promise<{ id: string | null; error: string | null }> {
  const validationError = validateCoupon(input);
  if (validationError) return { id: null, error: validationError };

  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code: input.code.trim().toUpperCase(),
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      min_order_amount: input.min_order_amount,
      max_uses: input.max_uses,
      expires_at: input.expires_at,
      is_active: input.is_active,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id as string, error: null };
}

export async function updateCoupon(supabase: SupabaseClient, id: string, input: CouponInput): Promise<{ error: string | null }> {
  const validationError = validateCoupon(input);
  if (validationError) return { error: validationError };

  const { error } = await supabase
    .from("coupons")
    .update({
      code: input.code.trim().toUpperCase(),
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      min_order_amount: input.min_order_amount,
      max_uses: input.max_uses,
      expires_at: input.expires_at,
      is_active: input.is_active,
    })
    .eq("id", id);

  return { error: error?.message ?? null };
}

export async function deleteCoupon(supabase: SupabaseClient, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  return { error: error?.message ?? null };
}
