import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminSupplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type SupplierInput = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  is_active: boolean;
};

export async function getAdminSuppliers(supabase: SupabaseClient, search?: string): Promise<{ suppliers: AdminSupplier[]; error: string | null }> {
  let query = supabase.from("suppliers").select("id, name, phone, email, address, notes, is_active, created_at").order("name", { ascending: true });

  if (search?.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) return { suppliers: [], error: error.message };
  return { suppliers: (data ?? []) as AdminSupplier[], error: null };
}

export async function getAdminSupplierById(supabase: SupabaseClient, id: string): Promise<AdminSupplier | null> {
  const { data, error } = await supabase.from("suppliers").select("id, name, phone, email, address, notes, is_active, created_at").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as AdminSupplier;
}

export async function createSupplier(supabase: SupabaseClient, input: SupplierInput): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      notes: input.notes || null,
      is_active: input.is_active,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id as string, error: null };
}

export async function updateSupplier(supabase: SupabaseClient, id: string, input: SupplierInput): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      notes: input.notes || null,
      is_active: input.is_active,
    })
    .eq("id", id);

  return { error: error?.message ?? null };
}
