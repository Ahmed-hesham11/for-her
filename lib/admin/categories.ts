import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase-paging";

export type AdminCategory = {
  id: string;
  name: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  parent_id: string | null;
  parent_name: string | null;
  product_count: number;
  sort_order: number;
  show_on_home: boolean;
};

export type CategoryInput = {
  name: string;
  image_url: string;
  is_active: boolean;
  parent_id: string | null;
  show_on_home: boolean;
};

export type CategoryOption = { id: string; name: string };

export async function getAdminCategories(supabase: SupabaseClient): Promise<{ categories: AdminCategory[]; error: string | null }> {
  const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from("categories").select("id, name, image_url, is_active, created_at, parent_id, sort_order, show_on_home").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    fetchAllRows<{ category_id: string }>((from, to) => supabase.from("products").select("category_id").order("id", { ascending: true }).range(from, to)),
  ]);

  if (categoriesError) return { categories: [], error: categoriesError.message };
  if (productsError) return { categories: [], error: productsError.message };

  const counts = new Map<string, number>();
  for (const row of (products ?? []) as { category_id: string }[]) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }

  type Row = Omit<AdminCategory, "product_count" | "parent_name">;
  const rows = (categories ?? []) as Row[];
  const nameById = new Map(rows.map((row) => [row.id, row.name]));

  const result = rows.map((category) => ({
    ...category,
    parent_name: category.parent_id ? nameById.get(category.parent_id) ?? null : null,
    product_count: counts.get(category.id) ?? 0,
  }));

  return { categories: result, error: null };
}

export async function getAdminCategoryById(supabase: SupabaseClient, id: string): Promise<AdminCategory | null> {
  const { data, error } = await supabase.from("categories").select("id, name, image_url, is_active, created_at, parent_id, sort_order, show_on_home").eq("id", id).maybeSingle();
  if (error || !data) return null;

  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id);

  let parent_name: string | null = null;
  if (data.parent_id) {
    const { data: parent } = await supabase.from("categories").select("name").eq("id", data.parent_id).maybeSingle();
    parent_name = parent?.name ?? null;
  }

  return { ...data, parent_name, product_count: count ?? 0 } as AdminCategory;
}

// Only top-level categories can be a parent — this is how the Clothes-only
// hierarchy stays exactly one level deep, with no special-casing of the
// name "Clothes" anywhere in the admin UI.
export async function getTopLevelCategoryOptions(supabase: SupabaseClient, excludeId?: string): Promise<CategoryOption[]> {
  let query = supabase.from("categories").select("id, name").is("parent_id", null).order("sort_order", { ascending: true }).order("name", { ascending: true });
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  return (data ?? []) as CategoryOption[];
}

export async function createCategory(supabase: SupabaseClient, input: CategoryInput): Promise<{ id: string | null; error: string | null }> {
  // New categories go to the end of their group (same parent).
  let lastQuery = supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  lastQuery = input.parent_id ? lastQuery.eq("parent_id", input.parent_id) : lastQuery.is("parent_id", null);
  const { data: last } = await lastQuery.maybeSingle();
  const sortOrder = last ? Number(last.sort_order) + 1 : 0;

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: input.name, image_url: input.image_url || null, is_active: input.is_active, parent_id: input.parent_id, show_on_home: input.show_on_home, sort_order: sortOrder })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id as string, error: null };
}

export async function updateCategory(supabase: SupabaseClient, id: string, input: CategoryInput): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("categories")
    .update({ name: input.name, image_url: input.image_url || null, is_active: input.is_active, parent_id: input.parent_id, show_on_home: input.show_on_home })
    .eq("id", id);

  return { error: error?.message ?? null };
}

// Saves a drag & drop result: `orderedIds` is one sibling group (all the
// top-level categories, or all subcategories of one parent) in its new order.
export async function reorderCategories(supabase: SupabaseClient, orderedIds: string[]): Promise<{ error: string | null }> {
  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("categories").update({ sort_order: index }).eq("id", id)),
  );
  const failed = results.find((result) => result.error);
  return { error: failed?.error?.message ?? null };
}
