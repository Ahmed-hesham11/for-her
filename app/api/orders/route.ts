import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

type OrderItemInput = { product_id: string; quantity: number };
type OrderRequest = {
  items?: OrderItemInput[];
  coupon_code?: string;
  customer_name?: string;
  phone_1?: string;
  phone_2?: string;
  governorate?: string;
  address?: string;
  payment_method?: "cod" | "card";
  notes?: string;
  request_id?: string;
};

const errorMessages: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "Authentication required",
  EMPTY_CART: "Your cart is empty.",
  INVALID_PRODUCT: "One of the products is no longer available.",
  INACTIVE_PRODUCT: "One of the products is no longer available.",
  INVALID_QUANTITY: "Each product quantity must be at least 1.",
  INVALID_COUPON: "This coupon is invalid.",
  EXPIRED_COUPON: "This coupon has expired.",
  MINIMUM_ORDER_NOT_MET: "This order does not meet the coupon minimum.",
  COUPON_USAGE_LIMIT_REACHED: "This coupon has reached its usage limit.",
  INVALID_PAYMENT_METHOD: "Select a valid payment method.",
  INVALID_GOVERNORATE: "Please select a valid governorate.",
};

function publicError(message: string) {
  const code = message.split(":", 1)[0];
  if (code === "INSUFFICIENT_STOCK") return `Insufficient stock for ${message.slice("INSUFFICIENT_STOCK:".length)}`;
  const known = errorMessages[code];
  if (known) return known;
  // Outside production, surface the real database error inline instead of
  // the generic fallback — this is the only way this specific failure was
  // ever going to be visible without direct server-log access.
  return process.env.NODE_ENV !== "production"
    ? `Unable to process your order right now. [debug: ${message}]`
    : "Unable to process your order right now.";
}

async function parseRequest(request: Request): Promise<OrderRequest> {
  const body = await request.json() as OrderRequest;
  if (!Array.isArray(body.items) || body.items.length === 0) throw new Error("EMPTY_CART");
  if (body.items.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw new Error("INVALID_QUANTITY");
  }
  return body;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !supabaseAdmin) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await parseRequest(request);

    const { data, error } = await supabaseAdmin.rpc("create_secure_order", {
      p_user_id: user.id,
      p_items: body.items,
      p_coupon_code: body.coupon_code?.trim() || null,
      p_customer_name: body.customer_name?.trim() || null,
      p_phone_1: body.phone_1?.trim() || null,
      p_phone_2: body.phone_2?.trim() || null,
      p_governorate: body.governorate?.trim() || null,
      p_address: body.address?.trim() || null,
      p_payment_method: body.payment_method ?? "cod",
      p_notes: body.notes?.trim() || null,
      p_request_id: body.request_id?.trim() || null,
    });
    if (error) {
      console.error("[api/orders] create_secure_order failed:", error.code, error.message, error.details, error.hint);
      return NextResponse.json({ error: publicError(error.message) }, { status: 400 });
    }
    return NextResponse.json({ order: data });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid order request." }, { status: 400 });
    const message = error instanceof Error ? error.message : "";
    console.error("[api/orders] unexpected error:", error);
    return NextResponse.json({ error: publicError(message) }, { status: 400 });
  }
}
