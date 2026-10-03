import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80";
const PRODUCT_FIELDS = "id, name, selling_price, original_price, image_url, category_id, description, sku, stock_quantity";

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

function mapProductRow(row: ProductRow, categoryNames: Map<string, string>) {
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.selling_price ?? 0),
    originalPrice: row.original_price === null ? null : Number(row.original_price),
    image: row.image_url || FALLBACK_IMAGE,
    category: row.category_id ? categoryNames.get(String(row.category_id)) ?? "Accessories" : "Accessories",
    description: row.description || "No description available.",
    sku: row.sku ?? "",
    stock: Number(row.stock_quantity ?? 0),
  };
}

async function loadWishlistItems(userId: string) {
  if (!supabaseAdmin) return [];

  const { data: rows } = await supabaseAdmin
    .from("wishlists")
    .select("product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return [];

  const productIds = rows.map((row) => row.product_id as string);
  const [{ data: productRows }, { data: categoryRows }] = await Promise.all([
    supabaseAdmin.from("products").select(PRODUCT_FIELDS).in("id", productIds),
    supabaseAdmin.from("categories").select("id, name"),
  ]);

  const categoryNames = new Map((categoryRows ?? []).map((category) => [String(category.id), category.name as string]));
  const productMap = new Map((productRows ?? []).map((row) => [String(row.id), row as ProductRow]));

  // Keep the wishlist's most-recently-added-first order — `in()` doesn't
  // preserve it. A product missing from productMap was deleted or
  // deactivated after being wishlisted — drop it rather than showing stale
  // data, same handling as before.
  return productIds
    .map((id) => {
      const row = productMap.get(id);
      return row ? mapProductRow(row, categoryNames) : null;
    })
    .filter((product): product is NonNullable<typeof product> => product !== null);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: await loadWishlistItems(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !supabaseAdmin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const productId = typeof body?.product_id === "string" ? body.product_id : "";
  if (!productId) return NextResponse.json({ error: "product_id is required." }, { status: 400 });

  const { error } = await supabaseAdmin.from("wishlists").insert({ user_id: user.id, product_id: productId });
  // 23505 = unique_violation: another click/tab already added this product.
  // The row exists exactly as intended, so this isn't a failure.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Unable to add this item to your wishlist right now." }, { status: 500 });
  }

  return NextResponse.json({ items: await loadWishlistItems(user.id) });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !supabaseAdmin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const productId = new URL(request.url).searchParams.get("product_id");
  if (!productId) return NextResponse.json({ error: "product_id is required." }, { status: 400 });

  const { error } = await supabaseAdmin.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId);
  if (error) return NextResponse.json({ error: "Unable to remove this item from your wishlist right now." }, { status: 500 });

  return NextResponse.json({ items: await loadWishlistItems(user.id) });
}
