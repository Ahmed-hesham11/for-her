import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminShippingRate = {
  id: string;
  governorate: string;
  shipping_fee: number;
  is_active: boolean;
};

export async function getAdminShippingRates(supabase: SupabaseClient): Promise<{ rates: AdminShippingRate[]; error: string | null }> {
  const { data, error } = await supabase
    .from("shipping_rates")
    .select("id, governorate, shipping_fee, is_active")
    .order("governorate", { ascending: true });

  if (error) return { rates: [], error: error.message };
  return { rates: (data ?? []) as AdminShippingRate[], error: null };
}

// One bulk save from the admin form — each row keeps its own id/governorate,
// only shipping_fee and is_active can change, so a plain array of per-row
// updates (rather than a full upsert) is what the form actually needs.
export async function updateShippingRates(
  supabase: SupabaseClient,
  updates: { id: string; shipping_fee: number; is_active: boolean }[],
): Promise<{ error: string | null }> {
  for (const update of updates) {
    const { error } = await supabase
      .from("shipping_rates")
      .update({ shipping_fee: update.shipping_fee, is_active: update.is_active })
      .eq("id", update.id);
    if (error) return { error: error.message };
  }
  return { error: null };
}
