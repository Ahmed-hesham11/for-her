import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Category, Product } from "@/lib/storefront-data";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80";
const CATEGORY_IMAGE_FALLBACKS: Record<string, string> = {
  blouse: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=80",
  chemise: "https://images.unsplash.com/photo-1598032895397-b9472444bf93?auto=format&fit=crop&w=900&q=80",
  burkini: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=80",
  swimsuit: "https://images.unsplash.com/photo-1566206091558-7f218b696731?auto=format&fit=crop&w=900&q=80",
  pants: "https://images.unsplash.com/photo-1506629905607-d405b7a7c708?auto=format&fit=crop&w=900&q=80",
  jeans: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80",
  jacket: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=80",
  coat: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=900&q=80",
  "t-shirt": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
  hoodie: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80",
  scarf: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&q=80",
  dress: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80",
  top: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=80",
  "basic sweater": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80",
  pullover: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=80",
  skirt: "https://images.unsplash.com/photo-1583496661160-fb5886a13d91?auto=format&fit=crop&w=900&q=80",
  pyjama: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=80",
  suit: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80",
  "hand chain": "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
  necklace: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
  ring: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
  earring: "https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=900&q=80",
  bracelet: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
  "ankle bracelet": "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=900&q=80",
  bangles: "https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&w=900&q=80",
  clothes: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80",
};

// Single shared categories fetch — getCategories(), getProducts() (for
// category-name resolution), getBestSellers(), getProductById(), and
// getRelatedProducts() all reuse this instead of each querying "categories"
// separately.
export async function getCategories(): Promise<Category[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, image_url, parent_id")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((category) => ({
    id: String(category.id),
    name: category.name,
    image: category.image_url || CATEGORY_IMAGE_FALLBACKS[category.name.toLowerCase()] || FALLBACK_IMAGE,
    slug: category.name.toLowerCase().replace(/\s+/g, "-"),
    parentId: category.parent_id ? String(category.parent_id) : null,
  }));
}

// Top-level categories only (Clothes shows as one card; its subcategories
// are browsed on /categories/[slug], not listed individually here).
export async function getTopLevelCategories(): Promise<Category[]> {
  const categories = await getCategories();
  return categories.filter((category) => category.parentId === null);
}

// Direct children of the category identified by `parentSlug`. Returns an
// empty array both when the slug doesn't resolve and when that category has
// no children — callers treat both the same way (not a hierarchical page).
export async function getSubcategories(parentSlug: string): Promise<Category[]> {
  const categories = await getCategories();
  const parent = categories.find((category) => category.slug === parentSlug.toLowerCase());
  if (!parent) return [];
  return categories.filter((category) => category.parentId === parent.id);
}

type ProductRow = {
  id: string;
  name: string;
  selling_price: number | null;
  original_price: number | null;
  image_url: string | null;
  category_id: string | null;
  description: string | null;
  sku: string | null;
  stock_quantity: number | null;
};

function mapProductRow(item: ProductRow, categoryNames: Map<string, string>): Product {
  return {
    id: String(item.id),
    name: item.name,
    price: Number(item.selling_price ?? 0),
    originalPrice: item.original_price === null ? null : Number(item.original_price),
    image: item.image_url || FALLBACK_IMAGE,
    category: item.category_id ? categoryNames.get(String(item.category_id)) ?? "Accessories" : "Accessories",
    description: item.description || "",
    sku: item.sku ?? "",
    stock: Number(item.stock_quantity ?? 0),
  };
}

const PRODUCT_FIELDS = "id, name, selling_price, original_price, image_url, category_id, description, sku, stock_quantity";

const getCachedCatalog = unstable_cache(
  async (): Promise<Product[]> => {
    const startedAt = performance.now();
    if (!supabase) return [];

    const [{ data: productRows, error: productsError }, categories] = await Promise.all([
      // No page-facing cap — /products paginates client-side over the full
      // active catalog. 1000 is only a sanity ceiling against a runaway query.
      supabase.from("products").select(PRODUCT_FIELDS).eq("is_active", true).order("created_at", { ascending: false }).limit(1000),
      getCategories(),
    ]);

    if (productsError || !productRows) return [];

    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const products = productRows.map((item) => mapProductRow(item, categoryNames));

    if (process.env.NODE_ENV !== "production") console.debug(`[perf] catalog fetch: ${(performance.now() - startedAt).toFixed(0)}ms (${products.length} products)`);
    return products;
  },
  ["storefront-catalog"],
  { revalidate: 60 },
);

export async function getProducts() {
  return getCachedCatalog();
}

const getCachedBestSellers = unstable_cache(
  async (limit: number): Promise<Product[]> => {
    if (!supabase) return [];

    const [{ data: productRows, error }, categories] = await Promise.all([
      supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("is_active", true)
        .eq("is_best_seller", true)
        .order("best_seller_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit),
      getCategories(),
    ]);

    if (error || !productRows) return [];

    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    return productRows.map((item) => mapProductRow(item, categoryNames));
  },
  ["storefront-best-sellers"],
  { revalidate: 60 },
);

export async function getBestSellers(limit = 5) {
  return getCachedBestSellers(limit);
}

// Targeted single-product lookup — avoids fetching the (capped) general
// catalog just to find one product by id.
export async function getProductById(id: string): Promise<Product | null> {
  if (!supabase) return null;

  const [{ data, error }, categories] = await Promise.all([
    supabase.from("products").select(PRODUCT_FIELDS).eq("id", id).eq("is_active", true).maybeSingle(),
    getCategories(),
  ]);

  if (error || !data) return null;

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  return mapProductRow(data, categoryNames);
}

// Related products, filtered server-side by the resolved category id rather
// than fetching every product and filtering by category name in JS.
export async function getRelatedProducts(categoryName: string, excludeId: string, limit = 4): Promise<Product[]> {
  if (!supabase) return [];

  const categories = await getCategories();
  const category = categories.find((item) => item.name.toLowerCase() === categoryName.toLowerCase());
  if (!category) return [];

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("category_id", category.id)
    .eq("is_active", true)
    .neq("id", excludeId)
    .limit(limit);

  if (error || !data) return [];

  const categoryNames = new Map(categories.map((item) => [item.id, item.name]));
  return data.map((item) => mapProductRow(item, categoryNames));
}
