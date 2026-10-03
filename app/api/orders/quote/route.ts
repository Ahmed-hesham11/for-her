import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

type QuoteRequest = {
  items?: { product_id: string; quantity: number }[];
  coupon_code?: string;
  governorate?: string;
};

const messages: Record<string, string> = {
  EMPTY_CART: "Your cart is empty.",
  INVALID_PRODUCT: "One of the products is no longer available.",
  INACTIVE_PRODUCT: "One of the products is no longer available.",
  INVALID_QUANTITY: "Each product quantity must be at least 1.",
  INVALID_COUPON: "This coupon is invalid.",
  EXPIRED_COUPON: "This coupon has expired.",
  MINIMUM_ORDER_NOT_MET: "This order does not meet the coupon minimum.",
  COUPON_USAGE_LIMIT_REACHED: "This coupon has reached its usage limit.",
};

function toPublicError(message: string) {
  const code = message.split(":", 1)[0];
  if (code === "INSUFFICIENT_STOCK") return `Insufficient stock for ${message.slice("INSUFFICIENT_STOCK:".length)}`;
  const known = messages[code];
  if (known) return known;
  return process.env.NODE_ENV !== "production"
    ? `Unable to calculate your order right now. [debug: ${message}]`
    : "Unable to calculate your order right now.";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !supabaseAdmin) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await request.json() as QuoteRequest;
    if (!Array.isArray(body.items) || body.items.length === 0) throw new Error("EMPTY_CART");
    if (body.items.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      throw new Error("INVALID_QUANTITY");
    }

    const { data, error } = await supabaseAdmin.rpc("calculate_order_quote", {
      p_items: body.items,
      p_coupon_code: body.coupon_code?.trim() || null,
      p_governorate: body.governorate?.trim() || null,
    });
    if (error) {
      console.error("[api/orders/quote] calculate_order_quote failed:", error.code, error.message, error.details, error.hint);
      return NextResponse.json({ error: toPublicError(error.message) }, { status: 400 });
    }
    return NextResponse.json({ quote: data });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid quote request." }, { status: 400 });
    console.error("[api/orders/quote] unexpected error:", error);
    return NextResponse.json({ error: toPublicError(error instanceof Error ? error.message : "") }, { status: 400 });
  }
}
