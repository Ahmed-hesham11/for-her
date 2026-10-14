import type { SupabaseClient } from "@supabase/supabase-js";

// Single global threshold for "low stock" everywhere in the admin — not a
// per-product setting. Keep in sync with the hardcoded value in the
// admin_low_stock_products / admin_stock_summary SQL functions.
export const LOW_STOCK_THRESHOLD = 5;

export type AdminProduct = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category_id: string;
  category_name: string;
  has_sizes: boolean;
  purchase_price: number;
  selling_price: number;
  original_price: number | null;
  stock_quantity: number;
  image_url: string | null;
  images: string[];
  videos: string[];
  is_active: boolean;
  is_best_seller: boolean;
  best_seller_order: number | null;
  created_at: string;
};

export type ProductOption = { id: string; name: string };
export type CategoryTreeOption = { id: string; name: string; parent_id: string | null };

export type ActiveFilter = "all" | "active" | "inactive";
export type StockFilter = "all" | "in_stock" | "low" | "out";

export type ProductListParams = {
  search?: string;
  categoryId?: string;
  active?: ActiveFilter;
  stock?: StockFilter;
  sortBy?: "created_at" | "name" | "selling_price" | "stock_quantity";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type ProductListResult = {
  products: AdminProduct[];
  total: number;
  page: number;
  pageSize: number;
  error: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category_id: string;
  has_sizes: boolean | null;
  purchase_price: number;
  selling_price: number;
  original_price: number | null;
  stock_quantity: number;
  image_url: string | null;
  images: string[] | null;
  videos: string[] | null;
  is_active: boolean;
  is_best_seller: boolean;
  best_seller_order: number | null;
  created_at: string;
  categories: { name: string } | { name: string }[] | null;
};

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function mapProductRow(row: ProductRow): AdminProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    description: row.description,
    category_id: row.category_id,
    has_sizes: Boolean(row.has_sizes),
    category_name: firstOrNull(row.categories)?.name ?? "Uncategorized",
    purchase_price: Number(row.purchase_price),
    selling_price: Number(row.selling_price),
    original_price: row.original_price === null ? null : Number(row.original_price),
    stock_quantity: Number(row.stock_quantity),
    image_url: row.image_url,
    images: row.images ?? [],
    videos: row.videos ?? [],
    is_active: row.is_active,
    is_best_seller: row.is_best_seller,
    best_seller_order: row.best_seller_order,
    created_at: row.created_at,
  };
}

const PRODUCT_SELECT = "id, name, sku, description, category_id, has_sizes, purchase_price, selling_price, original_price, stock_quantity, image_url, images, videos, is_active, is_best_seller, best_seller_order, created_at, categories(name)";

export async function getAdminProducts(supabase: SupabaseClient, params: ProductListParams = {}): Promise<ProductListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 20;
  const sortBy = params.sortBy ?? "created_at";
  const sortDir = params.sortDir ?? "desc";

  let lowStockIds: string[] | null = null;
  if (params.stock === "low") {
    const { data, error } = await supabase.rpc("admin_low_stock_products", { limit_count: 1000 });
    if (error) return { products: [], total: 0, page, pageSize, error: error.message };
    const ids = ((data ?? []) as { id: string; stock_quantity: number }[])
      .filter((row) => row.stock_quantity > 0)
      .map((row) => row.id);
    lowStockIds = ids;
    if (ids.length === 0) {
      return { products: [], total: 0, page, pageSize, error: null };
    }
  }

  let query = supabase.from("products").select(PRODUCT_SELECT, { count: "exact" });

  if (params.search) {
    const term = params.search.trim();
    if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }
  if (params.categoryId) query = query.eq("category_id", params.categoryId);
  if (params.active === "active") query = query.eq("is_active", true);
  if (params.active === "inactive") query = query.eq("is_active", false);
  if (params.stock === "out") query = query.lte("stock_quantity", 0);
  if (params.stock === "in_stock") query = query.gt("stock_quantity", 0);
  if (lowStockIds) query = query.in("id", lowStockIds);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) return { products: [], total: 0, page, pageSize, error: error.message };

  return {
    products: ((data ?? []) as unknown as ProductRow[]).map(mapProductRow),
    total: count ?? 0,
    page,
    pageSize,
    error: null,
  };
}

export async function getAdminProductById(supabase: SupabaseClient, id: string): Promise<AdminProduct | null> {
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapProductRow(data as unknown as ProductRow);
}

export async function getCategoryOptions(supabase: SupabaseClient): Promise<CategoryTreeOption[]> {
  const { data } = await supabase.from("categories").select("id, name, parent_id").order("name", { ascending: true });
  return (data ?? []) as CategoryTreeOption[];
}

export async function getSupplierOptions(supabase: SupabaseClient): Promise<ProductOption[]> {
  const { data } = await supabase.from("suppliers").select("id, name").order("name", { ascending: true });
  return (data ?? []) as ProductOption[];
}

export async function getProductOptions(supabase: SupabaseClient): Promise<ProductOption[]> {
  const { data } = await supabase.from("products").select("id, name").order("name", { ascending: true });
  return (data ?? []) as ProductOption[];
}

export type ProductPricedOption = { id: string; name: string; selling_price: number; stock_quantity: number; image_url: string | null };

// Only active products — this backs the manual/social order form's product
// picker. Out-of-stock ones are deliberately still included: an order can be
// placed regardless (see 20261008030000_allow_ordering_when_out_of_stock.sql),
// since the admin may know real stock exists even when the recorded count
// hasn't caught up yet.
export async function getActiveProductOptions(supabase: SupabaseClient): Promise<ProductPricedOption[]> {
  const { data } = await supabase
    .from("products")
    .select("id, name, selling_price, stock_quantity, image_url")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return ((data ?? []) as { id: string; name: string; selling_price: number; stock_quantity: number; image_url: string | null }[]).map((row) => ({
    ...row,
    selling_price: Number(row.selling_price),
    stock_quantity: Number(row.stock_quantity),
  }));
}

// A color of one product. `id` is present for a color that already exists
// (so saving keeps its identity — carts and past orders reference it) and
// absent for a newly added one. image_url is the color's main image and
// images[] its additional ones, same convention as the product itself.
export type ProductColorInput = { id?: string; name: string; image_url: string; images: string[] };
export type ProductSizeInput = { id?: string; label: string };
export type ProductSupplierInput = { supplier_id: string; purchase_price: number };

export type ProductInput = {
  name: string;
  sku: string;
  description: string;
  category_id: string;
  purchase_price: number;
  selling_price: number;
  original_price: number | null;
  image_url: string;
  images: string[];
  videos: string[];
  is_active: boolean;
  is_best_seller: boolean;
  best_seller_order: number | null;
  has_sizes: boolean;
  colors: ProductColorInput[];
  sizes: ProductSizeInput[];
  suppliers: ProductSupplierInput[];
};

// Ids assigned to the colors / sizes after a save, in the order they were sent.
export type SavedOptionIds = { colorIds: string[]; sizeIds: string[] };

export const MAX_PURCHASE_PRICE = 9_999_999.99;

const OPTION_ERROR_MESSAGES: Record<string, string> = {
  INVALID_PRODUCT: "المنتج غير موجود.",
  INVALID_COLOR_NAME: "اسم اللون مطلوب (حتى 60 حرفًا).",
  DUPLICATE_COLOR_NAME: "لا يمكن تكرار اسم اللون لنفس المنتج.",
  INVALID_SIZE_LABEL: "اسم المقاس مطلوب (حتى 30 حرفًا).",
  DUPLICATE_SIZE_LABEL: "لا يمكن تكرار المقاس لنفس المنتج.",
  SIZES_REQUIRED: "أضف مقاسًا واحدًا على الأقل أو اختر «لا» لخيار المقاسات.",
  INVALID_SUPPLIER: "أحد الموردين المحددين غير موجود.",
  DUPLICATE_SUPPLIER: "لا يمكن ربط نفس المورد بالمنتج أكثر من مرة.",
  INVALID_PURCHASE_PRICE: "سعر الشراء من المورد غير صالح.",
};

function optionErrorMessage(message: string): string {
  return OPTION_ERROR_MESSAGES[message.split(":", 1)[0]] ?? message;
}

// Server-side check of the colors / sizes / suppliers part of a product. The
// form validates the same rules for fast feedback, but this is the one that
// counts — the browser is never trusted.
export function validateProductOptions(input: ProductInput): string | null {
  const colorNames = new Set<string>();
  for (const color of input.colors) {
    const name = color.name.trim();
    if (!name || name.length > 60) return OPTION_ERROR_MESSAGES.INVALID_COLOR_NAME;
    if (colorNames.has(name.toLowerCase())) return OPTION_ERROR_MESSAGES.DUPLICATE_COLOR_NAME;
    colorNames.add(name.toLowerCase());
  }

  if (input.has_sizes) {
    if (input.sizes.length === 0) return OPTION_ERROR_MESSAGES.SIZES_REQUIRED;
    const labels = new Set<string>();
    for (const size of input.sizes) {
      const label = size.label.trim();
      if (!label || label.length > 30) return OPTION_ERROR_MESSAGES.INVALID_SIZE_LABEL;
      if (labels.has(label.toLowerCase())) return OPTION_ERROR_MESSAGES.DUPLICATE_SIZE_LABEL;
      labels.add(label.toLowerCase());
    }
  }

  const supplierIds = new Set<string>();
  for (const supplier of input.suppliers) {
    if (!supplier.supplier_id) return OPTION_ERROR_MESSAGES.INVALID_SUPPLIER;
    if (supplierIds.has(supplier.supplier_id)) return OPTION_ERROR_MESSAGES.DUPLICATE_SUPPLIER;
    supplierIds.add(supplier.supplier_id);
    if (!Number.isFinite(supplier.purchase_price) || supplier.purchase_price < 0 || supplier.purchase_price > MAX_PURCHASE_PRICE) {
      return OPTION_ERROR_MESSAGES.INVALID_PURCHASE_PRICE;
    }
  }

  return null;
}

// Replaces the product's colors, sizes and supplier links in one database
// transaction (see admin_save_product_options).
async function saveProductOptions(supabase: SupabaseClient, productId: string, input: ProductInput): Promise<{ ids: SavedOptionIds | null; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_save_product_options", {
    p_product_id: productId,
    p_has_sizes: input.has_sizes,
    p_colors: input.colors.map((color) => ({
      id: color.id ?? null,
      name: color.name.trim(),
      image_url: color.image_url.trim(),
      images: color.images.map((url) => url.trim()).filter(Boolean),
    })),
    p_sizes: input.has_sizes ? input.sizes.map((size) => ({ id: size.id ?? null, label: size.label.trim() })) : [],
    p_suppliers: input.suppliers.map((supplier) => ({
      supplier_id: supplier.supplier_id,
      // Two decimals, matching numeric(12,2) — avoids float noise like 10.100000000000001.
      purchase_price: Math.round(supplier.purchase_price * 100) / 100,
    })),
  });
  if (error) return { ids: null, error: optionErrorMessage(error.message) };

  const result = (data ?? {}) as { color_ids?: string[]; size_ids?: string[] };
  return { ids: { colorIds: result.color_ids ?? [], sizeIds: result.size_ids ?? [] }, error: null };
}

export type ProductOptions = {
  colors: Required<ProductColorInput>[];
  sizes: Required<ProductSizeInput>[];
  suppliers: ProductSupplierInput[];
};

export async function getAdminProductOptions(supabase: SupabaseClient, productId: string): Promise<ProductOptions> {
  const [colors, sizes, suppliers] = await Promise.all([
    supabase.from("product_colors").select("id, name, image_url, images").eq("product_id", productId).order("sort_order", { ascending: true }),
    supabase.from("product_sizes").select("id, label").eq("product_id", productId).order("sort_order", { ascending: true }),
    supabase.from("supplier_products").select("supplier_id, purchase_price").eq("product_id", productId).order("created_at", { ascending: true }),
  ]);

  return {
    colors: ((colors.data ?? []) as { id: string; name: string; image_url: string | null; images: string[] | null }[]).map((row) => ({
      id: row.id,
      name: row.name,
      image_url: row.image_url ?? "",
      images: row.images ?? [],
    })),
    sizes: ((sizes.data ?? []) as { id: string; label: string }[]).map((row) => ({ id: row.id, label: row.label })),
    suppliers: ((suppliers.data ?? []) as { supplier_id: string; purchase_price: number }[]).map((row) => ({
      supplier_id: row.supplier_id,
      purchase_price: Number(row.purchase_price),
    })),
  };
}

// stock_quantity is intentionally NOT part of this input — it's never set
// directly from the product form. A new product starts at 0; from then on
// it only ever changes via Purchases, customer orders (create_secure_order),
// and manual recounts on the Inventory page (setProductStock, below).
//
// purchase_price, unlike stock_quantity, IS editable here — a plain "current
// unit cost" field the admin can correct directly. Purchases still also
// overwrites it (to the latest received unit cost) whenever a purchase is
// marked received, same as before; editing it here is just another way it
// can change, not a replacement for that.
//
// Colors, sizes and supplier links are saved right after the product row, in
// a single transaction of their own. If that fails on create, the
// just-inserted product is removed again so no half-saved product is left.
export async function createProduct(supabase: SupabaseClient, input: ProductInput): Promise<{ id: string | null; error: string | null; optionIds?: SavedOptionIds }> {
  const invalid = validateProductOptions(input);
  if (invalid) return { id: null, error: invalid };

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name,
      sku: input.sku,
      description: input.description || null,
      category_id: input.category_id,
      purchase_price: input.purchase_price,
      selling_price: input.selling_price,
      original_price: input.original_price,
      stock_quantity: 0,
      image_url: input.image_url || null,
      images: input.images,
      videos: input.videos,
      is_active: input.is_active,
      is_best_seller: input.is_best_seller,
      best_seller_order: input.best_seller_order,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  const id = data.id as string;

  const saved = await saveProductOptions(supabase, id, input);
  if (saved.error) {
    await supabase.from("products").delete().eq("id", id);
    return { id: null, error: saved.error };
  }
  return { id, error: null, optionIds: saved.ids ?? undefined };
}

export async function updateProduct(supabase: SupabaseClient, id: string, input: ProductInput): Promise<{ error: string | null; optionIds?: SavedOptionIds }> {
  const invalid = validateProductOptions(input);
  if (invalid) return { error: invalid };

  const { error } = await supabase
    .from("products")
    .update({
      name: input.name,
      sku: input.sku,
      description: input.description || null,
      category_id: input.category_id,
      purchase_price: input.purchase_price,
      selling_price: input.selling_price,
      original_price: input.original_price,
      image_url: input.image_url || null,
      images: input.images,
      videos: input.videos,
      is_active: input.is_active,
      is_best_seller: input.is_best_seller,
      best_seller_order: input.best_seller_order,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const saved = await saveProductOptions(supabase, id, input);
  if (saved.error) return { error: saved.error };
  return { error: null, optionIds: saved.ids ?? undefined };
}

export async function setProductActive(supabase: SupabaseClient, id: string, isActive: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  return { error: error?.message ?? null };
}

// Backs the Inventory page's manual recount — directly overwrites
// stock_quantity instead of crediting/debiting it, for correcting the count
// to match a physical stock-take.
export async function setProductStock(supabase: SupabaseClient, id: string, quantity: number): Promise<{ error: string | null }> {
  if (!Number.isInteger(quantity) || quantity < 0) return { error: "Quantity must be a non-negative whole number." };
  const { error } = await supabase.from("products").update({ stock_quantity: quantity }).eq("id", id);
  return { error: error?.message ?? null };
}
