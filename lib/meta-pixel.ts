// Meta Pixel helpers. The pixel itself is bootstrapped by <MetaPixelScript />
// in the root layout; everything here is a safe no-op when it isn't loaded
// (admin pages, ad blockers, server render).

// The Pixel ID is public by design (it's visible in every page's source). The
// env var lets it be swapped without a code change; NEXT_PUBLIC_* values are
// inlined at BUILD time, so changing it requires a rebuild.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "1584150296802427";

// ISO 4217 code, sent verbatim by the pixel and the Conversions API alike.
export const META_CURRENCY = "EGP";
const CURRENCY = META_CURRENCY;

// Monetary amounts are always plain numbers rounded to 2 decimals (never
// formatted strings), so the pixel and the server copy carry the same value.
export const metaValue = (amount: number) => Math.round(Number(amount) * 100) / 100;

type Fbq = (command: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

export type PixelItem = { id: string; name: string; price: number; quantity: number };

// The product UUID (products.id) is the only product identifier: it is the
// Meta catalog item id and what every event sends in content_ids. Anything that
// is not a UUID is dropped rather than sent, since it could never match the catalog.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isProductId = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);

function validItems<T extends { id: string; price: number }>(items: T[], event: string): T[] {
  const valid = items.filter((item) => isProductId(item.id) && Number.isFinite(item.price) && item.price >= 0);
  if (valid.length !== items.length) console.warn(`[meta-pixel] ${event}: skipped ${items.length - valid.length} item(s) with a missing/non-UUID product id or invalid price`);
  return valid;
}

function fbq(command: string, ...args: unknown[]) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq(command, ...args);
}

// Sends a browser event through the pixel AND mirrors it to the server
// (/api/meta/event -> Conversions API). Both carry the same event id, so Meta
// counts it once while the server copy covers ad-blocked / lost pixel hits.
function track(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const eventId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fbq("track", eventName, params, { eventID: eventId });
  if (typeof window.fetch !== "function") return;
  window
    .fetch("/api/meta/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ event_name: eventName, event_id: eventId, event_time: Math.floor(Date.now() / 1000), source_url: window.location.href, custom_data: params ?? {} }),
    })
    .catch(() => {});
}

export function trackPageView() {
  track("PageView");
}

function ecommerceParams(items: PixelItem[]) {
  return {
    content_type: "product",
    content_ids: items.map((item) => item.id),
    contents: items.map((item) => ({ id: item.id, quantity: item.quantity, item_price: item.price })),
    num_items: items.reduce((sum, item) => sum + item.quantity, 0),
    currency: CURRENCY,
  };
}

export function trackViewContent(item: Omit<PixelItem, "quantity">) {
  if (validItems([item], "ViewContent").length === 0) return;
  track("ViewContent", {
    content_type: "product",
    content_ids: [item.id],
    content_name: item.name,
    contents: [{ id: item.id, quantity: 1, item_price: item.price }],
    value: item.price,
    currency: CURRENCY,
  });
}

export function trackAddToWishlist(item: Omit<PixelItem, "quantity">) {
  if (validItems([item], "AddToWishlist").length === 0) return;
  track("AddToWishlist", {
    content_type: "product",
    content_ids: [item.id],
    content_name: item.name,
    contents: [{ id: item.id, quantity: 1, item_price: item.price }],
    value: item.price,
    currency: CURRENCY,
  });
}

export function trackCompleteRegistration() {
  track("CompleteRegistration");
}

export function trackSearch(searchString: string) {
  track("Search", { search_string: searchString });
}

export function trackAddToCart(item: PixelItem) {
  if (validItems([item], "AddToCart").length === 0) return;
  track("AddToCart", {
    ...ecommerceParams([item]),
    content_name: item.name,
    value: item.price * item.quantity,
  });
}

export function trackInitiateCheckout(allItems: PixelItem[]) {
  const items = validItems(allItems, "InitiateCheckout");
  if (items.length === 0) return;
  track("InitiateCheckout", {
    ...ecommerceParams(items),
    value: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  });
}

// Fires at most once per order, even across retries, re-renders or reloads.
// The order id is Meta's eventID, and the server-side Purchase (outbox row
// event_id = orders.id) uses the same one, so Meta dedupes the pair. It is
// remembered in localStorage. `value` must be the server-confirmed order total;
// `items` are the purchased products (id = product UUID) so content_ids match
// the catalog. The server copy is NOT sent from here: it comes from the outbox.
export function trackPurchase(orderId: string, total: number, items: PixelItem[] = []) {
  // Number() also accepts a numeric string such as "230.00" from the API.
  const value = metaValue(total);
  if (!Number.isFinite(value) || value < 0) return;
  const storageKey = `meta_purchase_${orderId}`;
  try {
    if (window.localStorage.getItem(storageKey)) return;
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // Storage unavailable (private mode): fall through; the call site only
    // fires once per successful order anyway.
  }
  const purchased = validItems(items, "Purchase");
  fbq("track", "Purchase", { ...(purchased.length > 0 ? ecommerceParams(purchased) : { content_type: "product" }), value, currency: CURRENCY }, { eventID: orderId });
}
