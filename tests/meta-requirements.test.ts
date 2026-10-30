import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import React, { act } from "react";
import TestRenderer from "react-test-renderer";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { FakeBackend } from "./helpers/fake-backend";
import { MetaPixelScript } from "../components/meta-pixel-script";
import { MetaPixelTracker } from "../components/meta-pixel";
import { afterOrderCreated } from "../lib/meta-outbox";
import { buildContext } from "../lib/meta-capi";
import { trackAddToCart, trackInitiateCheckout, trackPurchase, trackViewContent } from "../lib/meta-pixel";

// Requirement-tagged suite. Tags [R1]..[R16] map to the numbered checklist in
// tests/report-reporter.mjs, which turns the results into test-report.md.
// Supabase and Meta are mocked at the HTTP level (tests/helpers/fake-backend.ts).

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const TOKEN = "TESTTOKEN_do_not_leak_123456";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake.supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key-0000";
process.env.META_CAPI_ACCESS_TOKEN = TOKEN;
delete process.env.META_CAPI_TEST_EVENT_CODE;

let backend: FakeBackend;
let restoreFetch: () => void;
let store: typeof import("../lib/meta-outbox-store");
const quiet = () => { const e = console.error, w = console.warn; console.error = () => {}; console.warn = () => {}; return () => { console.error = e; console.warn = w; }; };

before(async () => {
  backend = new FakeBackend();
  restoreFetch = backend.install();
  store = await import("../lib/meta-outbox-store"); // real supabase-js client + real store, fake HTTP
});
after(() => restoreFetch());
beforeEach(() => {
  backend.orders.clear(); backend.orderItems.length = 0; backend.outbox.length = 0; backend.metaRequests.length = 0;
  backend.metaReplies.length = 0; backend.requests.length = 0; backend.clockOffsetMs = 0; backend.onMeta = null; backend.metaGate = null;
});

const PRODUCT_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const twoItems = [{ sku: "DRESS-001", quantity: 2, unit_price: 200 }, { sku: "BAG-7", quantity: 1, unit_price: 100 }];

// ---- browser harness ------------------------------------------------------
type FbqCall = unknown[];
function fakeWindow() {
  const calls: FbqCall[] = [];
  const w = { fbq: (...a: unknown[]) => calls.push(a), localStorage: { getItem: () => null as string | null, setItem: () => {} } };
  (globalThis as Record<string, unknown>).window = w;
  return calls;
}
afterEach(() => { delete (globalThis as Record<string, unknown>).window; });

function runSnippet(pathname: string) {
  const el = MetaPixelScript() as React.ReactElement<{ children: React.ReactElement<{ dangerouslySetInnerHTML?: { __html: string } }>[] }>;
  const html = el.props.children[0].props.dangerouslySetInnerHTML!.__html;
  const inserted: string[] = [];
  const sandbox: Record<string, unknown> = {
    location: { pathname },
    document: {
      createElement: () => ({}),
      getElementsByTagName: () => [{ parentNode: { insertBefore: (s: { src: string }) => inserted.push(s.src) } }],
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(html, sandbox);
  const queue = ((sandbox.fbq as { queue?: ArrayLike<unknown>[] } | undefined)?.queue ?? []).map((a) => Array.from(a));
  return { html, inserted, queue, hasFbq: Boolean(sandbox.fbq) };
}

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out); else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("[R1] Pixel initialization happens only once", () => {
  test("[R1] the base snippet queues exactly one init and loads fbevents.js once", () => {
    const { queue, inserted } = runSnippet("/");
    assert.equal(queue.filter((c) => c[0] === "init").length, 1);
    assert.deepEqual(queue.find((c) => c[0] === "init"), ["init", "1584150296802427"]);
    assert.deepEqual(inserted, ["https://connect.facebook.net/en_US/fbevents.js"]);
    assert.equal(queue.some((c) => c[0] === "track"), false, "the snippet itself must not send PageView");
  });
  test("[R1] the snippet is skipped on /admin", () => {
    const { hasFbq, inserted } = runSnippet("/admin/orders");
    assert.equal(hasFbq, false); assert.equal(inserted.length, 0);
  });
  test("[R1] the layout mounts the script and tracker exactly once and no other file initializes the pixel", () => {
    const layout = read("app/layout.tsx");
    assert.equal(layout.split("<MetaPixelScript />").length - 1, 1);
    assert.equal(layout.split("<MetaPixelTracker />").length - 1, 1);
    const initFiles = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components")), ...walk(join(ROOT, "lib"))]
      .filter((f) => /fbq\(\s*['"`]init['"`]|fbq\(\\?'init\\?'/.test(readFileSync(f, "utf8")));
    assert.deepEqual(initFiles.map((f) => f.replace(ROOT, "").replace(/\\/g, "/")), ["/components/meta-pixel-script.tsx"]);
  });
  test("[R1] the noscript fallback is present", () => {
    const el = MetaPixelScript() as React.ReactElement<{ children: React.ReactElement<{ children: React.ReactElement<{ src: string }> }>[] }>;
    assert.match(el.props.children[1].props.children.props.src, /facebook\.com\/tr\?id=1584150296802427&ev=PageView&noscript=1/);
  });
});

describe("[R2] PageView fires once on load and on navigation", () => {
  test("[R2] one PageView per distinct route, none on re-render, none on /admin", async () => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const calls = fakeWindow();
    const tree = (pathname: string, search = "") => React.createElement(PathnameContext.Provider, { value: pathname },
      React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams(search) as never }, React.createElement(MetaPixelTracker)));
    const pageViews = () => calls.filter((c) => c[0] === "track" && c[1] === "PageView").length;

    const settle = () => new Promise((r) => setTimeout(r, 400));
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(tree("/")); }); await settle();
    assert.equal(pageViews(), 1, "initial load");
    await act(async () => { renderer.update(tree("/")); }); await settle();
    assert.equal(pageViews(), 1, "re-render of the same route");
    await act(async () => { renderer.update(tree("/products")); }); await settle();
    assert.equal(pageViews(), 2, "client-side navigation");
    await act(async () => { renderer.update(tree("/product/abc")); }); await settle();
    assert.equal(pageViews(), 3);
    await act(async () => { renderer.update(tree("/redirect")); renderer.update(tree("/product/final")); }); await settle();
    assert.equal(pageViews(), 4, "a redirect reports only the final route");
    await act(async () => { renderer.update(tree("/admin/orders")); }); await settle();
    assert.equal(pageViews(), 4, "admin excluded");
    await act(async () => { renderer.unmount(); });
  });
});

describe("[R3] ViewContent", () => {
  test("[R3] sends the SKU (not the product UUID) with name, value and EGP", () => {
    const calls = fakeWindow();
    trackViewContent({ sku: "DRESS-001", name: "Summer Dress", price: 250 });
    assert.equal(calls.length, 1); assert.equal(calls[0][1], "ViewContent");
    assert.deepEqual(calls[0][2], { content_type: "product", content_ids: ["DRESS-001"], content_name: "Summer Dress", contents: [{ id: "DRESS-001", quantity: 1, item_price: 250 }], value: 250, currency: "EGP" });
  });
  test("[R3] the product page passes product.sku, and ViewContent runs once per product id", () => {
    const src = read("components/product-detail-client.tsx");
    assert.match(src, /trackViewContent\(\{ sku: product\.sku,/);
    assert.match(src, /\[product\.id\]/);
  });
});

describe("[R4] AddToCart", () => {
  test("[R4] sends SKU, quantity and value = price × quantity", () => {
    const calls = fakeWindow();
    trackAddToCart({ sku: "DRESS-001", name: "Dress", price: 200, quantity: 3 });
    const p = calls[0][2] as Record<string, unknown>;
    assert.equal(calls[0][1], "AddToCart"); assert.deepEqual(p.content_ids, ["DRESS-001"]); assert.equal(p.value, 600); assert.equal(p.num_items, 3); assert.equal(p.currency, "EGP");
    assert.deepEqual(p.contents, [{ id: "DRESS-001", quantity: 3, item_price: 200 }]);
  });
  test("[R4] the cart fires it only after the server accepted the add (not on failure paths)", () => {
    const src = read("components/cart-provider.tsx");
    const track = src.indexOf("trackAddToCart({");
    assert.equal(src.split("trackAddToCart({").length - 1, 1);
    assert.ok(track > src.indexOf("setItems((body.items"), "after the server response is applied");
    assert.ok(track > src.indexOf("if (!response.ok || !body) {"), "after the failed-response early return");
    assert.ok(track < src.indexOf("} catch {", track), "inside the try, so the catch path never tracks");
    assert.match(src.slice(track, track + 200), /return true;/);
  });
});

describe("[R5] InitiateCheckout", () => {
  test("[R5] sends every cart SKU, total quantity and the summed value", () => {
    const calls = fakeWindow();
    trackInitiateCheckout([{ sku: "DRESS-001", name: "a", price: 200, quantity: 2 }, { sku: "BAG-7", name: "b", price: 100, quantity: 1 }]);
    const p = calls[0][2] as Record<string, unknown>;
    assert.equal(calls[0][1], "InitiateCheckout"); assert.deepEqual(p.content_ids, ["DRESS-001", "BAG-7"]); assert.equal(p.num_items, 3); assert.equal(p.value, 500); assert.equal(p.currency, "EGP");
  });
  test("[R5] the checkout page fires it once per visit, guarded by a ref", () => {
    const src = read("app/checkout/page.tsx");
    assert.equal(src.split("trackInitiateCheckout(").length - 1, 1);
    assert.match(src, /checkoutTracked\.current/);
  });
});

describe("[R6] Purchase only after successful order creation", () => {
  test("[R6] the browser call sits after the failed-response throw and is the only call site", () => {
    const src = read("app/checkout/page.tsx");
    assert.equal(src.split("trackPurchase(").length - 1, 1);
    assert.ok(src.indexOf("trackPurchase(") > src.indexOf("if (!response.ok || !result.order) throw"));
  });
  test("[R6] a failed (rolled-back) order leaves no outbox row, so the worker sends nothing", async () => {
    const summary = await store.runMetaOutbox({ limit: 10 });
    assert.deepEqual(summary, { claimed: 0, sent: 0, retried: 0, failed: 0, leaseLost: 0 });
    assert.equal(backend.metaRequests.length, 0);
  });
  test("[R6] a failed order response produces no browser Purchase", () => {
    const src = read("app/checkout/page.tsx");
    const catchIdx = src.indexOf("} catch (orderFailure)");
    assert.ok(catchIdx > src.indexOf("trackPurchase("), "tracking sits in the try body, before the catch");
    assert.equal(src.slice(catchIdx, catchIdx + 200).includes("trackPurchase"), false);
  });
});

describe("[R7] browser and server Purchase share one event_id", () => {
  test("[R7] same event_name and event_id (the order id)", async () => {
    const orderId = backend.createOrder({ total: 500, items: twoItems });
    const calls = fakeWindow();
    trackPurchase(orderId, 500);
    await store.runMetaOutbox({ orderId });
    const server = backend.metaRequests[0].body.data[0];
    assert.equal(calls[0][1], "Purchase"); assert.equal(server.event_name, "Purchase");
    assert.equal((calls[0][3] as { eventID: string }).eventID, orderId); assert.equal(server.event_id, orderId);
  });
  test("[R7] the event_id is stable across retries", async () => {
    const orderId = backend.createOrder({ total: 500, items: twoItems });
    backend.metaReplies.push({ status: 500 });
    const restore = quiet(); await store.runMetaOutbox({ orderId }); backend.advance(2 * 60_000); await store.runMetaOutbox({ orderId }); restore();
    assert.equal(backend.metaRequests.length, 2);
    assert.deepEqual(backend.metaRequests.map((r) => r.body.data[0].event_id), [orderId, orderId]);
  });
});

describe("[R8] Purchase uses the saved order_items", () => {
  test("[R8] content_ids, num_items and value come from the database rows", async () => {
    const orderId = backend.createOrder({ total: 540, items: twoItems });
    await store.runMetaOutbox({ orderId });
    const cd = backend.metaRequests[0].body.data[0].custom_data as Record<string, unknown>;
    assert.deepEqual(cd.content_ids, ["DRESS-001", "BAG-7"]); assert.equal(cd.num_items, 3); assert.equal(cd.value, 540); assert.equal(cd.currency, "EGP");
    assert.ok(backend.requests.some((r) => r.url.includes("/rest/v1/order_items") && r.url.includes(`order_id=eq.${orderId}`)), "order_items read by order id");
  });
  test("[R8] later changes to the DB rows (not to any client data) change the payload", async () => {
    const orderId = backend.createOrder({ total: 540, items: twoItems });
    backend.orderItems.find((i) => i.sku === "BAG-7")!.sku = "BAG-9";
    await store.runMetaOutbox({ orderId });
    assert.deepEqual((backend.metaRequests[0].body.data[0].custom_data as { content_ids: string[] }).content_ids, ["DRESS-001", "BAG-9"]);
  });
  test("[R8] the order route no longer reads items, prices or totals from the request for Meta", () => {
    const route = read("app/api/orders/route.ts");
    const block = route.slice(route.indexOf("// Meta Purchase:"), route.indexOf("return NextResponse.json({ order: data })"));
    assert.equal(/body\.items|selling_price|total_amount/.test(block), false);
  });
});

describe("[R9] missing SKUs never fall back to UUIDs", () => {
  test("[R9] items with null or blank SKU are excluded; the product UUID never appears in the payload", async () => {
    const orderId = backend.createOrder({ total: 300, items: [{ sku: "OK-1", quantity: 1, unit_price: 100 }, { sku: null, quantity: 1, unit_price: 100 }, { sku: "  ", quantity: 1, unit_price: 100 }] });
    backend.orderItems.forEach((i) => { i.product_id = PRODUCT_UUID; });
    const restore = quiet(); await store.runMetaOutbox({ orderId }); restore();
    const body = backend.metaRequests[0].body;
    assert.deepEqual((body.data[0].custom_data as { content_ids: string[] }).content_ids, ["OK-1"]);
    assert.equal(JSON.stringify(body).includes(PRODUCT_UUID), false);
  });
  test("[R9] an order with no SKUs still reports value but omits content_ids entirely", async () => {
    const orderId = backend.createOrder({ total: 100, items: [{ sku: null, quantity: 1, unit_price: 100 }] });
    const restore = quiet(); await store.runMetaOutbox({ orderId }); restore();
    const cd = backend.metaRequests[0].body.data[0].custom_data as Record<string, unknown>;
    assert.equal("content_ids" in cd, false); assert.equal(cd.value, 100);
  });
  test("[R9] browser events with an empty SKU are dropped", () => {
    const calls = fakeWindow();
    trackViewContent({ sku: "", name: "x", price: 5 }); trackAddToCart({ sku: " ", name: "x", price: 5, quantity: 1 });
    trackInitiateCheckout([{ sku: "", name: "x", price: 5, quantity: 1 }]);
    assert.equal(calls.length, 0);
  });
});

describe("[R10] invalid prices and totals are rejected", () => {
  test("[R10] browser: NaN / negative prices and totals send nothing", () => {
    const calls = fakeWindow(); const restore = quiet();
    trackViewContent({ sku: "A", name: "x", price: NaN }); trackAddToCart({ sku: "A", name: "x", price: -1, quantity: 1 });
    trackInitiateCheckout([{ sku: "A", name: "x", price: Infinity, quantity: 1 }]);
    trackPurchase("o1", NaN); trackPurchase("o2", -5);
    restore(); assert.equal(calls.length, 0);
  });
  test("[R10] server: a negative or non-numeric order total is failed permanently, never sent", async () => {
    const restore = quiet();
    const a = backend.createOrder({ total: -5, items: twoItems });
    const b = backend.createOrder({ total: Number.NaN, items: twoItems });
    backend.orders.get(b)!.total_amount = "abc";
    const summary = await store.runMetaOutbox({ limit: 10 }); restore();
    assert.equal(summary && "failed" in summary ? summary.failed : -1, 2);
    assert.equal(backend.metaRequests.length, 0);
    assert.deepEqual(backend.outbox.map((r) => r.last_error), ["INVALID_VALUE", "INVALID_VALUE"]); assert.ok(a && b);
  });
  test("[R10] server: an item with an invalid unit_price is excluded from content_ids", async () => {
    const orderId = backend.createOrder({ total: 300, items: [{ sku: "GOOD", quantity: 1, unit_price: 100 }, { sku: "BAD", quantity: 1, unit_price: -4 }] });
    await store.runMetaOutbox({ orderId });
    assert.deepEqual((backend.metaRequests[0].body.data[0].custom_data as { content_ids: string[] }).content_ids, ["GOOD"]);
  });
});

describe("[R11] duplicate Purchase attempts are prevented", () => {
  test("[R11] the outbox allows one row per order", () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems });
    backend.enqueue(orderId, new Date().toISOString()); backend.enqueue(orderId, new Date().toISOString());
    assert.equal(backend.outbox.length, 1);
  });
  test("[R11] two workers racing for one order produce exactly one Meta request", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems });
    const [a, b] = await Promise.all([store.runMetaOutbox({ orderId }), store.runMetaOutbox({ orderId })]);
    assert.equal(backend.metaRequests.length, 1);
    const claimed = [a, b].map((s) => ("claimed" in s ? s.claimed : 0));
    assert.deepEqual(claimed.sort(), [0, 1]);
  });
  test("[R11] a sent event is never sent again, by the fast path or the cron", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems });
    await store.runMetaOutbox({ orderId }); await store.runMetaOutbox({ limit: 10 }); backend.advance(86_400_000); await store.runMetaOutbox({ limit: 10 });
    assert.equal(backend.metaRequests.length, 1);
  });
});

describe("[R12] failed Meta requests remain retryable", () => {
  test("[R12] 500, 429, timeout and network errors all leave the event pending with a future retry time", async () => {
    const restore = quiet();
    for (const reply of [{ status: 500 }, { status: 429 }, "timeout", "network"] as const) {
      backend.outbox.length = 0; backend.metaReplies.push(reply as never);
      const orderId = backend.createOrder({ total: 100, items: twoItems });
      await store.runMetaOutbox({ orderId });
      const row = backend.outbox.find((r) => r.order_id === orderId)!;
      assert.equal(row.status, "pending", String(JSON.stringify(reply))); assert.ok(Date.parse(row.next_attempt_at) > backend.now());
      assert.ok(row.last_error); assert.equal(row.sent_at, null);
    }
    restore();
  });
  test("[R12] it is delivered on a later run, with attempts counted and the original event_time", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems });
    const created = Math.floor(Date.parse(backend.outbox[0].event_time) / 1000);
    backend.metaReplies.push({ status: 503 }); const restore = quiet();
    await store.runMetaOutbox({ orderId }); assert.equal((await store.runMetaOutbox({ orderId }) as { claimed: number }).claimed, 0, "not due yet");
    backend.advance(2 * 60_000); await store.runMetaOutbox({ orderId }); restore();
    assert.equal(backend.outbox[0].status, "sent"); assert.equal(backend.outbox[0].attempts, 2);
    assert.deepEqual(backend.metaRequests.map((r) => r.body.data[0].event_time), [created, created]);
  });
  test("[R12] a permanent Meta error (400, code 100) is failed, not retried", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems }); backend.metaReplies.push({ status: 400, body: { error: { code: 100 } } });
    const restore = quiet(); await store.runMetaOutbox({ orderId }); restore();
    assert.equal(backend.outbox[0].status, "failed"); assert.equal(backend.outbox[0].last_error, "HTTP_400_CODE_100");
    backend.advance(86_400_000); await store.runMetaOutbox({ limit: 10 }); assert.equal(backend.metaRequests.length, 1);
  });
});

describe("[R13] abandoned jobs are recovered", () => {
  test("[R13] a worker that dies after claiming is recovered once its lease expires", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems });
    const claimed = await store.supabaseOutboxStore.claim(10, 180, orderId); // …and the worker crashes
    assert.equal(claimed.length, 1); assert.equal(backend.outbox[0].status, "processing");
    await store.runMetaOutbox({ orderId }); assert.equal(backend.metaRequests.length, 0, "lease still held");
    backend.advance(181_000); await store.runMetaOutbox({ orderId });
    assert.equal(backend.metaRequests.length, 1); assert.equal(backend.outbox[0].status, "sent"); assert.equal(backend.outbox[0].attempts, 2);
  });
  test("[R13] a worker whose lease was taken over cannot overwrite the new result", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems });
    const [stale] = await store.supabaseOutboxStore.claim(10, 180, orderId);
    backend.advance(181_000); await store.runMetaOutbox({ orderId });
    assert.equal(await store.supabaseOutboxStore.markFailed(stale, "LATE"), false); assert.equal(backend.outbox[0].status, "sent");
  });
});

describe("[R13] stale worker while the new worker is mid-send", () => {
  test("[R13] a stale worker cannot mark an event sent/failed while another worker holds a newer lease", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems });
    const [stale] = await store.supabaseOutboxStore.claim(10, 180, orderId);
    backend.advance(181_000);
    let release!: () => void; backend.metaGate = new Promise<void>((r) => { release = r; });
    const second = store.runMetaOutbox({ orderId }); // takes over, now waiting on Meta
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(backend.outbox[0].status, "processing");
    assert.equal(await store.supabaseOutboxStore.markSent(stale), false);
    assert.equal(await store.supabaseOutboxStore.markFailed(stale, "LATE"), false);
    assert.equal(backend.outbox[0].status, "processing", "the newer lease is untouched");
    release(); await second; assert.equal(backend.outbox[0].status, "sent");
  });
});

describe("[R14] lifecycle pending → processing → sent", () => {
  test("[R14] states are observed in order and sent_at is recorded only after Meta accepts", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems });
    const seen: string[] = [backend.outbox[0].status];
    backend.onMeta = () => { seen.push(backend.outbox[0].status); };
    const summary = await store.runMetaOutbox({ orderId });
    seen.push(backend.outbox[0].status);
    assert.deepEqual(seen, ["pending", "processing", "sent"]);
    assert.deepEqual(summary, { claimed: 1, sent: 1, retried: 0, failed: 0, leaseLost: 0 });
    const row = backend.outbox[0]; assert.ok(row.sent_at); assert.equal(row.lease_token, null); assert.equal(row.locked_until, null); assert.equal(row.last_error, null);
  });
  test("[R14] pending → processing → pending (retry) → processing → sent", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems }); backend.metaReplies.push({ status: 500 });
    const seen: string[] = []; backend.onMeta = () => seen.push(backend.outbox[0].status);
    const restore = quiet(); await store.runMetaOutbox({ orderId }); seen.push(backend.outbox[0].status);
    backend.advance(120_000); await store.runMetaOutbox({ orderId }); seen.push(backend.outbox[0].status); restore();
    assert.deepEqual(seen, ["processing", "pending", "processing", "sent"]);
  });
  test("[R14] an unconfigured token leaves events pending without consuming an attempt", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems }); delete process.env.META_CAPI_ACCESS_TOKEN;
    try { assert.deepEqual(await store.runMetaOutbox({ orderId }), { skipped: "META_NOT_CONFIGURED" }); } finally { process.env.META_CAPI_ACCESS_TOKEN = TOKEN; }
    assert.equal(backend.outbox[0].status, "pending"); assert.equal(backend.outbox[0].attempts, 0); assert.equal(backend.metaRequests.length, 0);
  });
});

describe("[R15] the access token never reaches the browser", () => {
  test("[R15] the token is sent in the request body, never the URL, and never logged", async () => {
    const logs: string[] = []; const e = console.error, w = console.warn; console.error = console.warn = (...a: unknown[]) => { logs.push(a.join(" ")); };
    backend.metaReplies.push({ status: 400, body: { error: { code: 100, message: TOKEN } } });
    const orderId = backend.createOrder({ total: 100, items: twoItems }); await store.runMetaOutbox({ orderId });
    backend.createOrder({ total: 100, items: twoItems }); await store.runMetaOutbox({ limit: 10 }); console.error = e; console.warn = w;
    for (const r of backend.metaRequests) { assert.equal(r.url.includes(TOKEN) || r.url.includes("access_token"), false); assert.equal(r.body.access_token, TOKEN); }
    assert.equal(logs.join(" ").includes(TOKEN), false);
    assert.equal(backend.outbox.some((r) => JSON.stringify(r).includes(TOKEN)), false, "token is never persisted in the outbox");
  });
  test("[R15] no client component imports server-only Meta/Supabase-admin modules or reads the token", () => {
    const offenders: string[] = [];
    for (const file of [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components")), ...walk(join(ROOT, "lib"))]) {
      const src = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(src)) continue;
      if (/meta-capi|meta-outbox|supabase\/admin|cron-auth|META_CAPI|META_CRON|SERVICE_ROLE/.test(src)) offenders.push(file.replace(ROOT, ""));
    }
    assert.deepEqual(offenders, []);
  });
  test("[R15] no NEXT_PUBLIC_ variable carries a secret, and only API routes/lib import the CAPI modules", () => {
    const all = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components")), ...walk(join(ROOT, "lib"))];
    for (const f of all) assert.equal(/NEXT_PUBLIC_[A-Z_]*(TOKEN|SECRET|ACCESS|SERVICE)/.test(readFileSync(f, "utf8")), false, f);
    assert.equal(/META_CAPI|META_CRON/.test(readFileSync(join(ROOT, ".env.example"), "utf8").split("\n").filter((l) => l.startsWith("NEXT_PUBLIC_")).join("")), false);
    const importers = all.filter((f) => /from "@\/lib\/(meta-capi|meta-outbox-store|cron-auth)"/.test(readFileSync(f, "utf8"))).map((f) => f.replace(ROOT, "").replace(/\\/g, "/"));
    for (const f of importers) assert.ok(/^\/(app\/api\/|lib\/)/.test(f), `${f} must be server-side`);
  });
  test("[R15] the built client bundle contains neither the real token nor the variable name (skipped if no build exists)", (t) => {
    const dir = join(ROOT, ".next", "static");
    if (!existsSync(dir)) return t.skip("no .next/static — run `npm run build` first");
    const real = (readFileSync(join(ROOT, ".env.local"), "utf8").match(/^META_CAPI_ACCESS_TOKEN=(.*)$/m)?.[1] ?? "").replace(/["\r]/g, "");
    const bad: string[] = [];
    const scan = (d: string) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) scan(f); else if (/\.(js|css|map|html)$/.test(n)) { const c = readFileSync(f, "utf8"); if ((real && c.includes(real)) || c.includes("META_CAPI_ACCESS_TOKEN") || c.includes("META_CRON_SECRET")) bad.push(f); } } };
    scan(dir); assert.deepEqual(bad, []);
  });
});

describe("[R16] checkout does not wait for the Meta API", () => {
  test("[R16] with Meta held open, the post-order step still returns immediately; the event is sent when Meta answers", async () => {
    const orderId = backend.createOrder({ total: 100, items: twoItems });
    let release!: () => void; backend.metaGate = new Promise<void>((r) => { release = r; });
    const tasks: Promise<unknown>[] = [];
    const started = Date.now();
    await afterOrderCreated({
      orderId, saveContext: store.supabaseOutboxStore.saveContext, deliver: (id) => store.runMetaOutbox({ orderId: id, limit: 1 }),
      context: buildContext({ email: "a@b.com", userId: "user-1", clientIp: "1.2.3.4", userAgent: "ua", cookieHeader: "_fbp=fb.1.2.3", sourceUrl: "https://shop/checkout" }),
      schedule: (task) => { tasks.push(task()); },
    });
    const elapsed = Date.now() - started;
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(elapsed < 500, `returned in ${elapsed}ms`); assert.equal(backend.metaRequests.length, 1, "Meta request is in flight");
    assert.equal(backend.outbox[0].status, "processing", "still waiting on Meta while checkout already returned");
    assert.deepEqual(Object.keys(backend.outbox[0].context ?? {}).sort(), ["client_ip", "client_user_agent", "em", "external_id", "fbc", "fbp", "source_url"]);
    release(); await Promise.all(tasks);
    assert.equal(backend.outbox[0].status, "sent");
  });
  test("[R16] the order route uses after() and does not await delivery", () => {
    const route = read("app/api/orders/route.ts");
    assert.match(route, /schedule: \(task\) => after\(task\)/); assert.equal(/await runMetaOutbox|await sendMeta/.test(route), false);
  });
});
