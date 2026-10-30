import { after, NextResponse } from "next/server";
import { buildContext, isMetaConfigured, sendMetaEvent, type MetaEvent } from "@/lib/meta-capi";

export const dynamic = "force-dynamic";

// Server copy of browser pixel events (Conversions API). The browser sends the
// same event_id to the pixel, so Meta de-duplicates the pair. Purchase is NOT
// accepted here: it goes through the order outbox.
const ALLOWED = new Set(["PageView", "ViewContent", "Search", "AddToCart", "InitiateCheckout", "AddToWishlist", "CompleteRegistration"]);
const CURRENCY = "EGP";

type Body = { event_name?: unknown; event_id?: unknown; event_time?: unknown; source_url?: unknown; custom_data?: unknown };

const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

// Rebuilds custom_data from known fields only; nothing from the client is passed through as-is.
function cleanCustomData(raw: unknown): Record<string, unknown> {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const ids = Array.isArray(input.content_ids) ? input.content_ids.map((id) => str(id, 100)).filter((id): id is string => id !== null).slice(0, 50) : [];
  if (ids.length) out.content_ids = ids;
  if (input.content_type === "product") out.content_type = "product";
  const name = str(input.content_name, 300);
  if (name) out.content_name = name;
  const search = str(input.search_string, 200);
  if (search) out.search_string = search;
  const value = num(input.value);
  if (value !== null) { out.value = value; out.currency = CURRENCY; }
  const numItems = num(input.num_items);
  if (numItems !== null) out.num_items = Math.floor(numItems);
  if (Array.isArray(input.contents)) {
    const contents = input.contents.slice(0, 50).flatMap((c) => {
      const item = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
      const id = str(item.id, 100); const quantity = num(item.quantity); const price = num(item.item_price);
      return id && quantity !== null && price !== null ? [{ id, quantity: Math.floor(quantity), item_price: price }] : [];
    });
    if (contents.length) out.contents = contents;
  }
  return out;
}

export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const name = str(body.event_name, 40);
  const eventId = str(body.event_id, 100);
  if (!name || !ALLOWED.has(name) || !eventId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (!isMetaConfigured()) return new NextResponse(null, { status: 204 });

  const nowSec = Math.floor(Date.now() / 1000);
  const t = num(body.event_time);
  const context = buildContext({
    email: null,
    userId: null,
    clientIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent"),
    cookieHeader: request.headers.get("cookie"),
    sourceUrl: str(body.source_url, 2000) ?? request.headers.get("referer"),
  });

  const userData: Record<string, unknown> = {};
  if (context.client_ip) userData.client_ip_address = context.client_ip;
  if (context.client_user_agent) userData.client_user_agent = context.client_user_agent;
  if (context.fbp) userData.fbp = context.fbp;
  if (context.fbc) userData.fbc = context.fbc;

  const event: MetaEvent = {
    event_name: name,
    event_time: t !== null && t <= nowSec && nowSec - t < 6 * 24 * 3600 ? Math.floor(t) : nowSec,
    event_id: eventId,
    action_source: "website",
    ...(context.source_url ? { event_source_url: context.source_url } : {}),
    user_data: userData,
    custom_data: cleanCustomData(body.custom_data),
  };

  after(async () => { await sendMetaEvent(event); });
  return new NextResponse(null, { status: 204 });
}
