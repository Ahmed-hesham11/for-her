import { createHash } from "node:crypto";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

// Meta Conversions API (server-side events). Sent from the order route so a
// Purchase still reaches Meta when the browser blocks fbevents.js. The order
// id is the event_id, matching the browser pixel's eventID so Meta dedupes
// the two. A silent no-op when META_CAPI_ACCESS_TOKEN isn't set.

// Overridable without a code change if Meta retires this version.
const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v24.0";

export type CapiPurchase = {
  orderId: string;
  value: number;
  items: { sku: string; quantity: number; price: number }[];
  sourceUrl: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  clientIp: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// Egyptian numbers: 01012345678 -> 201012345678 (Meta wants country code, digits only).
function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("20")) return digits;
  return `20${digits.replace(/^0+/, "")}`;
}

export async function sendPurchaseToMeta(purchase: CapiPurchase) {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token || !META_PIXEL_ID) return;

  const phone = purchase.phone ? normalizePhone(purchase.phone) : null;
  const firstName = purchase.name?.trim().split(/\s+/)[0]?.toLowerCase();

  const userData: Record<string, unknown> = {};
  if (purchase.email) userData.em = [sha256(purchase.email.trim().toLowerCase())];
  if (phone) userData.ph = [sha256(phone)];
  if (firstName) userData.fn = [sha256(firstName)];
  userData.country = [sha256("eg")];
  if (purchase.clientIp) userData.client_ip_address = purchase.clientIp;
  if (purchase.userAgent) userData.client_user_agent = purchase.userAgent;
  if (purchase.fbp) userData.fbp = purchase.fbp;
  if (purchase.fbc) userData.fbc = purchase.fbc;

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: purchase.orderId,
        action_source: "website",
        event_source_url: purchase.sourceUrl,
        user_data: userData,
        custom_data: {
          currency: "EGP",
          value: purchase.value,
          content_type: "product",
          content_ids: purchase.items.map((item) => item.sku),
          contents: purchase.items.map((item) => ({ id: item.sku, quantity: item.quantity, item_price: item.price })),
          num_items: purchase.items.reduce((sum, item) => sum + item.quantity, 0),
        },
      },
    ],
    ...(process.env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE } : {}),
  };

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) console.error("[meta-capi] Purchase rejected:", response.status, await response.text());
  } catch (error) {
    console.error("[meta-capi] Purchase failed:", error);
  }
}
