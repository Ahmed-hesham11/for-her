import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80";

async function ensureCartId(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const { data: existing } = await supabaseAdmin.from("carts").select("id").eq("user_id", userId).limit(1).maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabaseAdmin.from("carts").insert({ user_id: userId }).select("id").single();
  if (error) return null;
  return created.id as string;
}

async function loadCartItems(cartId: string) {
  if (!supabaseAdmin) return [];

  const { data: cartItems } = await supabaseAdmin.from("cart_items").select("product_id, quantity").eq("cart_id", cartId);
  if (!cartItems || cartItems.length === 0) return [];

  const productIds = cartItems.map((row) => row.product_id as string);
  const { data: products } = await supabaseAdmin.from("products").select("id, name, selling_price, image_url").in("id", productIds);
  const productMap = new Map((products ?? []).map((product) => [String(product.id), product]));

  return cartItems
    .map((row) => {
      const product = productMap.get(String(row.product_id));
      // Product was deleted or deactivated after being added — drop it
      // from view rather than showing stale/fabricated details.
      if (!product) return null;
      return {
        id: String(product.id),
        name: String(product.name),
        price: Number(product.selling_price ?? 0),
        image: (product.image_url as string | null) || FALLBACK_IMAGE,
        quantity: Number(row.quantity),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [] });

  const cartId = await ensureCartId(user.id);
  if (!cartId) return NextResponse.json({ error: "Unable to load your cart right now." }, { status: 500 });

  return NextResponse.json({ items: await loadCartItems(cartId) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !supabaseAdmin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const productId = typeof body?.product_id === "string" ? body.product_id : "";
  const quantity = Math.max(1, Math.floor(Number(body?.quantity) || 1));
  if (!productId) return NextResponse.json({ error: "product_id is required." }, { status: 400 });

  const cartId = await ensureCartId(user.id);
  if (!cartId) return NextResponse.json({ error: "Unable to update your cart right now." }, { status: 500 });

  const { data: existingRow } = await supabaseAdmin
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existingRow) {
    const { error } = await supabaseAdmin
      .from("cart_items")
      .update({ quantity: Number(existingRow.quantity) + quantity })
      .eq("id", existingRow.id);
    if (error) return NextResponse.json({ error: "Unable to update your cart right now." }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("cart_items").insert({ cart_id: cartId, product_id: productId, quantity });
    if (error) return NextResponse.json({ error: "Unable to add this item to your cart right now." }, { status: 500 });
  }

  return NextResponse.json({ items: await loadCartItems(cartId) });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !supabaseAdmin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const productId = typeof body?.product_id === "string" ? body.product_id : "";
  const quantity = Math.max(0, Math.floor(Number(body?.quantity) || 0));
  if (!productId) return NextResponse.json({ error: "product_id is required." }, { status: 400 });

  const { data: cart } = await supabaseAdmin.from("carts").select("id").eq("user_id", user.id).maybeSingle();
  if (!cart) return NextResponse.json({ items: [] });

  if (quantity <= 0) {
    const { error } = await supabaseAdmin.from("cart_items").delete().eq("cart_id", cart.id).eq("product_id", productId);
    if (error) return NextResponse.json({ error: "Unable to update your cart right now." }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("cart_items").update({ quantity }).eq("cart_id", cart.id).eq("product_id", productId);
    if (error) return NextResponse.json({ error: "Unable to update your cart right now." }, { status: 500 });
  }

  return NextResponse.json({ items: await loadCartItems(cart.id) });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !supabaseAdmin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: cart } = await supabaseAdmin.from("carts").select("id").eq("user_id", user.id).maybeSingle();
  if (!cart) return NextResponse.json({ items: [] });

  const productId = new URL(request.url).searchParams.get("product_id");

  if (productId) {
    const { error } = await supabaseAdmin.from("cart_items").delete().eq("cart_id", cart.id).eq("product_id", productId);
    if (error) return NextResponse.json({ error: "Unable to remove this item right now." }, { status: 500 });
    return NextResponse.json({ items: await loadCartItems(cart.id) });
  }

  const { error } = await supabaseAdmin.from("cart_items").delete().eq("cart_id", cart.id);
  if (error) return NextResponse.json({ error: "Unable to clear your cart right now." }, { status: 500 });
  return NextResponse.json({ items: [] });
}
