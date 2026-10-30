// Meta Pixel helpers. The pixel itself is bootstrapped by <MetaPixelScript />
// in the root layout; everything here is a safe no-op when it isn't loaded
// (admin pages, ad blockers, server render).

// The Pixel ID is public by design (it's visible in every page's source). The
// env var lets it be swapped without a code change; NEXT_PUBLIC_* values are
// inlined at BUILD time, so changing it requires a rebuild.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "1584150296802427";

const CURRENCY = "EGP";

type Fbq = (command: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

export type PixelItem = { sku: string; name: string; price: number; quantity: number };

// Meta Catalog item IDs are product SKUs, never the internal UUID. An item
// without a SKU (or with a bad price) is dropped rather than sent under the
// wrong ID, which would break catalog matching.
function validItems<T extends { sku: string; price: number }>(items: T[], event: string): T[] {
  const valid = items.filter((item) => item.sku?.trim() && Number.isFinite(item.price) && item.price >= 0);
  if (valid.length !== items.length) console.warn(`[meta-pixel] ${event}: skipped ${items.length - valid.length} item(s) with missing SKU or invalid price`);
  return valid;
}

function fbq(command: string, ...args: unknown[]) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq(command, ...args);
}

export function trackPageView() {
  fbq("track", "PageView");
}

function ecommerceParams(items: PixelItem[]) {
  return {
    content_type: "product",
    content_ids: items.map((item) => item.sku),
    contents: items.map((item) => ({ id: item.sku, quantity: item.quantity, item_price: item.price })),
    num_items: items.reduce((sum, item) => sum + item.quantity, 0),
    currency: CURRENCY,
  };
}

export function trackViewContent(item: Omit<PixelItem, "quantity">) {
  if (validItems([item], "ViewContent").length === 0) return;
  fbq("track", "ViewContent", {
    content_type: "product",
    content_ids: [item.sku],
    content_name: item.name,
    contents: [{ id: item.sku, quantity: 1, item_price: item.price }],
    value: item.price,
    currency: CURRENCY,
  });
}

export function trackSearch(searchString: string) {
  fbq("track", "Search", { search_string: searchString });
}

export function trackAddToCart(item: PixelItem) {
  if (validItems([item], "AddToCart").length === 0) return;
  fbq("track", "AddToCart", {
    ...ecommerceParams([item]),
    content_name: item.name,
    value: item.price * item.quantity,
  });
}

export function trackInitiateCheckout(allItems: PixelItem[]) {
  const items = validItems(allItems, "InitiateCheckout");
  if (items.length === 0) return;
  fbq("track", "InitiateCheckout", {
    ...ecommerceParams(items),
    value: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  });
}

// Fires at most once per order, even across retries, re-renders or reloads:
// the order id doubles as Meta's eventID (so it would also dedupe against a
// future server-side Conversions API event) and is remembered in localStorage.
// `value` must be the server-confirmed order total.
export function trackPurchase(orderId: string, value: number, allItems: PixelItem[]) {
  const items = validItems(allItems, "Purchase");
  if (items.length === 0 || !Number.isFinite(value) || value < 0) return;
  const storageKey = `meta_purchase_${orderId}`;
  try {
    if (window.localStorage.getItem(storageKey)) return;
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // Storage unavailable (private mode): fall through; the call site only
    // fires once per successful order anyway.
  }
  fbq("track", "Purchase", { ...ecommerceParams(items), value, currency: CURRENCY }, { eventID: orderId });
}
