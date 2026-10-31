import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OPTION_ERRORS: Record<string, string> = {
  COLOR_REQUIRED: "Please choose a color.",
  INVALID_COLOR: "That color is not available for this product.",
  SIZE_REQUIRED: "Please choose a size.",
  INVALID_SIZE: "That size is not available for this product.",
};

// cart_items.id's type isn't defined in this repo's migrations, so line ids
// are only checked for a safe shape rather than as a strict uuid.
function lineId(value: unknown): string | null {
  const text = typeof value === "number" ? String(value) : value;
  return typeof text === "string" && /^[\w-]{1,64}$/.test(text) ? text : null;
}

function optionalUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

async function ensureCartId(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const { data: existing } = await supabaseAdmin.from("carts").select("id").eq("user_id", userId).limit(1).maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabaseAdmin.from("carts").insert({ user_id: userId }).select("id").single();
  if (error) return null;
  return created.id as string;
}

// Each cart line is one (product, color, size) combination. `id` stays the
// product id (checkout and the server re-price from it); `lineId` identifies
// the line itself for quantity edits and removal.
async function loadCartItems(cartId: string) {
  if (!supabaseAdmin) return [];

  const { data: cartItems } = await supabaseAdmin.from("cart_items").select("id, product_id, quantity, color_id, size_id").eq("cart_id", cartId);
  if (!cartItems || cartItems.length === 0) return [];

  const productIds = [...new Set(cartItems.map((row) => row.product_id as string))];
  const colorIds = [...new Set(cartItems.map((row) => row.color_id as string | null).filter((id): id is string => Boolean(id)))];
  const sizeIds = [...new Set(cartItems.map((row) => row.size_id as string | null).filter((id): id is string => Boolean(id)))];

  const [{ data: products }, { data: colors }, { data: sizes }] = await Promise.all([
    supabaseAdmin.from("products").select("id, name, selling_price, image_url").in("id", productIds),
    colorIds.length > 0 ? supabaseAdmin.from("product_colors").select("id, name, image_url").in("id", colorIds) : Promise.resolve({ data: [] }),
    sizeIds.length > 0 ? supabaseAdmin.from("product_sizes").select("id, label").in("id", sizeIds) : Promise.resolve({ data: [] }),
  ]);
  const productMap = new Map((products ?? []).map((product) => [String(product.id), product]));
  const colorMap = new Map((colors ?? []).map((color) => [String(color.id), color]));
  const sizeMap = new Map((sizes ?? []).map((size) => [String(size.id), size]));

  return cartItems
    .map((row) => {
      const product = productMap.get(String(row.product_id));
      // Product was deleted or deactivated after being added — drop it
      // from view rather than showing stale/fabricated details.
      if (!product) return null;
      const color = row.color_id ? colorMap.get(String(row.color_id)) : undefined;
      const size = row.size_id ? sizeMap.get(String(row.size_id)) : undefined;
      return {
        lineId: String(row.id),
        id: String(product.id),
        name: String(product.name),
        // Always the live price from the products table — never client-supplied.
        price: Number(product.selling_price ?? 0),
        image: (color?.image_url as string | null | undefined) || (product.image_url as string | null) || FALLBACK_IMAGE,
        quantity: Number(row.quantity),
        colorId: color ? String(color.id) : null,
        colorName: color ? String(color.name) : null,
        sizeId: size ? String(size.id) : null,
        sizeName: size ? String(size.label) : null,
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

  const { data: product } = await supabaseAdmin.from("products").select("id, is_active").eq("id", productId).maybeSingle();
  if (!product || !product.is_active) return NextResponse.json({ error: "This product is no longer available." }, { status: 400 });

  // The color/size are validated against the product on the server (the same
  // rules checkout applies) — a color or size belonging to another product,
  // or a missing required one, is rejected here.
  const { data: resolved, error: optionError } = await supabaseAdmin
    .rpc("resolve_item_options", {
      p_product_id: productId,
      p_color_id: optionalUuid(body?.color_id),
      p_size_id: optionalUuid(body?.size_id),
    })
    .maybeSingle();
  if (optionError) {
    const message = OPTION_ERRORS[optionError.message.split(":", 1)[0]];
    if (message) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.json({ error: "Unable to add this item to your cart right now." }, { status: 500 });
  }
  const colorId = (resolved as { r_color_id: string | null } | null)?.r_color_id ?? null;
  const sizeId = (resolved as { r_size_id: string | null } | null)?.r_size_id ?? null;

  const cartId = await ensureCartId(user.id);
  if (!cartId) return NextResponse.json({ error: "Unable to update your cart right now." }, { status: 500 });

  const addToExisting = async () => {
    let lookup = supabaseAdmin!.from("cart_items").select("id, quantity").eq("cart_id", cartId).eq("product_id", productId);
    lookup = colorId ? lookup.eq("color_id", colorId) : lookup.is("color_id", null);
    lookup = sizeId ? lookup.eq("size_id", sizeId) : lookup.is("size_id", null);
    const { data: existingRow } = await lookup.maybeSingle();
    if (!existingRow) return null;
    const { error } = await supabaseAdmin!
      .from("cart_items")
      .update({ quantity: Number(existingRow.quantity) + quantity })
      .eq("id", existingRow.id);
    return error ?? false;
  };

  // Same product + color + size merges into the existing line.
  let outcome = await addToExisting();
  if (outcome === null) {
    const { error } = await supabaseAdmin.from("cart_items").insert({ cart_id: cartId, product_id: productId, quantity, color_id: colorId, size_id: sizeId });
    if (error) {
      // A concurrent add created the line first (unique index) — merge into it.
      outcome = error.code === "23505" ? await addToExisting() : error;
      if (outcome === null) outcome = error;
    } else {
      outcome = false;
    }
  }
  if (outcome) return NextResponse.json({ error: "Unable to add this item to your cart right now." }, { status: 500 });

  return NextResponse.json({ items: await loadCartItems(cartId) });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !supabaseAdmin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const itemId = lineId(body?.item_id);
  const quantity = Math.max(0, Math.floor(Number(body?.quantity) || 0));
  if (!itemId) return NextResponse.json({ error: "item_id is required." }, { status: 400 });

  const { data: cart } = await supabaseAdmin.from("carts").select("id").eq("user_id", user.id).maybeSingle();
  if (!cart) return NextResponse.json({ items: [] });

  if (quantity <= 0) {
    const { error } = await supabaseAdmin.from("cart_items").delete().eq("cart_id", cart.id).eq("id", itemId);
    if (error) return NextResponse.json({ error: "Unable to update your cart right now." }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("cart_items").update({ quantity }).eq("cart_id", cart.id).eq("id", itemId);
    if (error) return NextResponse.json({ error: "Unable to update your cart right now." }, { status: 500 });
  }

  return NextResponse.json({ items: await loadCartItems(cart.id) });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !supabaseAdmin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: cart } = await supabaseAdmin.from("carts").select("id").eq("user_id", user.id).maybeSingle();
  if (!cart) return NextResponse.json({ items: [] });

  const itemId = lineId(new URL(request.url).searchParams.get("item_id"));

  if (itemId) {
    const { error } = await supabaseAdmin.from("cart_items").delete().eq("cart_id", cart.id).eq("id", itemId);
    if (error) return NextResponse.json({ error: "Unable to remove this item right now." }, { status: 500 });
    return NextResponse.json({ items: await loadCartItems(cart.id) });
  }

  const { error } = await supabaseAdmin.from("cart_items").delete().eq("cart_id", cart.id);
  if (error) return NextResponse.json({ error: "Unable to clear your cart right now." }, { status: 500 });
  return NextResponse.json({ items: [] });
}
