import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { backoffSeconds, buildPurchaseEvent, afterOrderCreated, processOutbox, MAX_ATTEMPTS, type OrderSnapshot, type OutboxRow, type OutboxStore } from "../lib/meta-outbox";
import { sendMetaEvent, sha256, type MetaEvent, type MetaSendResult, type OutboxContext } from "../lib/meta-capi";
import { isAuthorizedCron } from "../lib/cron-auth";
import { trackPurchase } from "../lib/meta-pixel";

const ORDER_ID = "11111111-2222-3333-4444-555555555555";
const T0 = Date.parse("2026-10-30T10:00:00Z");

const ctx: OutboxContext = { em: sha256("a@b.com"), external_id: sha256("u1"), client_ip: "1.2.3.4", client_user_agent: "ua", fbp: "fb.1", fbc: null, source_url: "https://shop/checkout" };

function makeOrder(over: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return { id: ORDER_ID, user_id: "u1", total_amount: 540, customer_name: "Sara Ali", phone_1: "01012345678", governorate: "Cairo",
    items: [{ product_id: "DRESS-001", quantity: 2, unit_price: 200 }, { product_id: "BAG-7", quantity: 1, unit_price: 100 }], ...over };
}

function makeRow(over: Partial<OutboxRow> = {}): OutboxRow {
  return { id: "e", order_id: ORDER_ID, event_id: ORDER_ID, event_time: new Date(T0).toISOString(), attempts: 1, lease_token: "l", context: ctx, ...over };
}

// In-memory store mirroring claim_meta_events and the conditional updates.
type Row = OutboxRow & { status: "pending" | "processing" | "sent" | "failed"; next_attempt_at: number; locked_until: number | null; last_error: string | null };
function memoryStore(clock: { now: number }, order: OrderSnapshot | null = makeOrder()) {
  const rows: Row[] = [];
  let leases = 0;
  const add = (over: Partial<Row> = {}) => {
    const row: Row = { id: `ev${rows.length + 1}`, order_id: ORDER_ID, event_id: ORDER_ID, event_time: new Date(T0).toISOString(), attempts: 0, lease_token: "", context: ctx,
      status: "pending", next_attempt_at: clock.now, locked_until: null, last_error: null, ...over };
    rows.push(row);
    return row;
  };
  const owns = (row: OutboxRow) => rows.find((r) => r.id === row.id && r.status === "processing" && r.lease_token === row.lease_token);
  const store: OutboxStore & { rows: Row[]; add: typeof add } = {
    rows, add,
    async claim(limit, leaseSeconds, orderId) {
      const due = rows.filter((r) => (!orderId || r.order_id === orderId) &&
        ((r.status === "pending" && r.next_attempt_at <= clock.now) || (r.status === "processing" && (r.locked_until ?? 0) < clock.now))).slice(0, limit);
      for (const r of due) { r.status = "processing"; r.lease_token = `lease-${++leases}`; r.locked_until = clock.now + leaseSeconds * 1000; r.attempts += 1; }
      return due.map((r) => ({ ...r }));
    },
    async loadOrder() { return order; },
    async markSent(row) { const r = owns(row); if (!r) return false; r.status = "sent"; r.lease_token = ""; return true; },
    async markRetry(row, next, error) { const r = owns(row); if (!r) return false; r.status = "pending"; r.next_attempt_at = next.getTime(); r.last_error = error; r.lease_token = ""; return true; },
    async markFailed(row, error) { const r = owns(row); if (!r) return false; r.status = "failed"; r.last_error = error; r.lease_token = ""; return true; },
    async saveContext() {},
  };
  return store;
}

const ok = async (): Promise<MetaSendResult> => ({ ok: true });
const run = (store: OutboxStore, clock: { now: number }, send: (e: MetaEvent) => Promise<MetaSendResult>, extra = {}) =>
  processOutbox({ store, send, now: () => clock.now, ...extra });

describe("delivery states", () => {
  test("successful Meta delivery marks the event sent; it is not sent twice", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add(); const sent: MetaEvent[] = [];
    const summary = await run(store, clock, async (e) => { sent.push(e); return { ok: true }; });
    assert.equal(summary.sent, 1); assert.equal(store.rows[0].status, "sent");
    await run(store, clock, async (e) => { sent.push(e); return { ok: true }; });
    assert.equal(sent.length, 1);
  });

  test("failed delivery stays retryable with backoff, then succeeds", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add();
    const s1 = await run(store, clock, async () => ({ ok: false, retryable: true, reason: "HTTP_500" }));
    assert.equal(s1.retried, 1); assert.equal(store.rows[0].status, "pending"); assert.equal(store.rows[0].last_error, "HTTP_500");
    assert.equal((await run(store, clock, ok)).claimed, 0, "not due yet");
    clock.now += backoffSeconds(1) * 1000 + 1;
    assert.equal((await run(store, clock, ok)).sent, 1);
  });

  test("Meta timeout does not lose the event", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add();
    const original = globalThis.fetch; const savedToken = process.env.META_CAPI_ACCESS_TOKEN;
    process.env.META_CAPI_ACCESS_TOKEN = "tok_1234567890abcdef";
    globalThis.fetch = (async () => { throw new DOMException("t", "TimeoutError"); }) as typeof fetch;
    const err = console.error; console.error = () => {};
    try {
      const s = await run(store, clock, sendMetaEvent);
      assert.equal(s.retried, 1); assert.equal(store.rows[0].status, "pending"); assert.equal(store.rows[0].last_error, "TIMEOUT");
    } finally {
      globalThis.fetch = original; console.error = err;
      if (savedToken === undefined) delete process.env.META_CAPI_ACCESS_TOKEN; else process.env.META_CAPI_ACCESS_TOKEN = savedToken;
    }
  });

  test("a permanent API error is failed, not retried forever", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add();
    const s = await run(store, clock, async () => ({ ok: false, retryable: false, reason: "HTTP_400_CODE_100" }));
    assert.equal(s.failed, 1); assert.equal(store.rows[0].status, "failed");
    clock.now += 86_400_000; assert.equal((await run(store, clock, ok)).claimed, 0);
  });

  test("retries stop after MAX_ATTEMPTS", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add({ attempts: MAX_ATTEMPTS });
    const s = await run(store, clock, ok);
    assert.equal(s.failed, 1); assert.equal(store.rows[0].last_error, "MAX_ATTEMPTS");
  });

  test("events past Meta's 7-day limit are failed without sending", async () => {
    const clock = { now: T0 + 7 * 86_400_000 }; const store = memoryStore(clock); store.add(); let sends = 0;
    await run(store, clock, async () => { sends++; return { ok: true }; });
    assert.equal(sends, 0); assert.equal(store.rows[0].last_error, "EXPIRED");
  });

  test("an unexpected exception keeps the event retryable", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add();
    const err = console.error; console.error = () => {};
    const s = await run(store, clock, async () => { throw new TypeError("boom"); });
    console.error = err;
    assert.equal(s.retried, 1); assert.equal(store.rows[0].status, "pending");
  });
});

describe("concurrency and crash recovery", () => {
  test("two workers cannot process the same event", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add(); store.add({ id: "ev2" }); const sent: string[] = [];
    const send = async (e: MetaEvent): Promise<MetaSendResult> => { sent.push(e.event_id); await new Promise((r) => setTimeout(r, 5)); return { ok: true }; };
    const [a, b] = await Promise.all([run(store, clock, send, { limit: 1 }), run(store, clock, send, { limit: 1 })]);
    assert.equal(a.claimed + b.claimed, 2); assert.equal(store.rows.filter((r) => r.status === "sent").length, 2);
    const again = await Promise.all([run(store, clock, send), run(store, clock, send)]);
    assert.equal(again[0].claimed + again[1].claimed, 0);
    assert.equal(sent.length, 2);
  });

  test("two workers racing for one event: exactly one gets it", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add(); let sends = 0;
    const send = async (): Promise<MetaSendResult> => { sends++; return { ok: true }; };
    const [a, b] = await Promise.all([run(store, clock, send), run(store, clock, send)]);
    assert.equal(a.claimed + b.claimed, 1); assert.equal(sends, 1);
  });

  test("a crash after claiming is recovered once the lease expires", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add();
    const crashed = await store.claim(10, 180); assert.equal(crashed.length, 1); // the worker dies here
    assert.equal((await run(store, clock, ok)).claimed, 0, "lease still active");
    clock.now += 181_000;
    const s = await run(store, clock, ok);
    assert.equal(s.sent, 1); assert.equal(store.rows[0].attempts, 2);
  });

  test("a stale worker cannot overwrite the result after its lease was taken over", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add();
    const [stale] = await store.claim(10, 180); clock.now += 181_000;
    await run(store, clock, ok); // a new worker finishes it
    assert.equal(await store.markFailed(stale, "LATE"), false); assert.equal(store.rows[0].status, "sent");
  });
});

describe("payload", () => {
  test("replaying an order uses the same event_id and the saved order_items", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock, makeOrder()); store.add(); const events: MetaEvent[] = [];
    await run(store, clock, async (e) => { events.push(e); return { ok: false, retryable: true, reason: "X" }; });
    clock.now += 3_600_000; await run(store, clock, async (e) => { events.push(e); return { ok: true }; });
    assert.equal(events.length, 2); assert.equal(events[0].event_id, ORDER_ID); assert.equal(events[1].event_id, ORDER_ID);
    assert.deepEqual(events[0].custom_data.content_ids, ["DRESS-001", "BAG-7"]);
    assert.equal(events[0].custom_data.num_items, 3); assert.equal(events[0].custom_data.value, 540);
    assert.deepEqual(events[0].custom_data, events[1].custom_data);
    assert.deepEqual(events[0].user_data, events[1].user_data);
  });

  test("event_time is orders.created_at and unchanged across retries", async () => {
    const clock = { now: T0 + 1000 }; const store = memoryStore(clock); store.add(); const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      await run(store, clock, async (e) => { times.push(e.event_time); return { ok: false, retryable: true, reason: "X" }; });
      clock.now += 7 * 3_600_000;
    }
    assert.equal(times.length, 3); assert.deepEqual(new Set(times), new Set([Math.floor(T0 / 1000)]));
  });

  test("items without a product id are excluded", () => {
    const mixed = buildPurchaseEvent(makeRow(), makeOrder({ items: [{ product_id: "A-1", quantity: 1, unit_price: 10 }, { product_id: null, quantity: 1, unit_price: 5 }, { product_id: "  ", quantity: 1, unit_price: 5 }] }), null, T0 + 1);
    assert.deepEqual(mixed.custom_data.content_ids, ["A-1"]); assert.equal(mixed.custom_data.num_items, 3);
    const none = buildPurchaseEvent(makeRow(), makeOrder({ items: [{ product_id: null, quantity: 1, unit_price: 5 }] }), null, T0 + 1);
    assert.equal("content_ids" in none.custom_data, false); assert.equal(none.custom_data.value, 540);
    assert.equal(JSON.stringify(none.custom_data).includes(ORDER_ID), false);
  });

  test("value comes from the saved order total", () => {
    const e = buildPurchaseEvent(makeRow({ context: null }), makeOrder({ total_amount: 123.456 }), "https://shop/checkout", T0 + 1);
    assert.equal(e.custom_data.value, 123.46); assert.equal(e.event_source_url, "https://shop/checkout"); assert.equal(e.custom_data.currency, "EGP");
  });

  test("browser and server Purchase share the same event_name and event_id", () => {
    const fb: unknown[][] = [];
    (globalThis as Record<string, unknown>).window = { fbq: (...a: unknown[]) => fb.push(a), localStorage: { getItem: () => null, setItem: () => {} } };
    trackPurchase(ORDER_ID, 540);
    const server = buildPurchaseEvent(makeRow(), makeOrder(), null, T0 + 1);
    assert.equal(fb[0][1], "Purchase"); assert.equal(server.event_name, "Purchase");
    assert.equal((fb[0][3] as { eventID: string }).eventID, server.event_id);
    delete (globalThis as Record<string, unknown>).window;
  });
});

describe("checkout latency", () => {
  test("the order response does not wait for the Meta API", async () => {
    let finishMeta!: () => void; let metaStarted = false; const tasks: Promise<unknown>[] = [];
    const t0 = Date.now();
    await afterOrderCreated({
      orderId: ORDER_ID, context: ctx, saveContext: async () => {},
      deliver: () => new Promise<void>((resolve) => { metaStarted = true; finishMeta = resolve; }),
      schedule: (task) => { tasks.push(task()); },
    });
    assert.ok(Date.now() - t0 < 100); assert.equal(metaStarted, true); // started, but not awaited
    finishMeta(); await Promise.all(tasks);
  });

  test("a context-save or delivery failure never throws into checkout", async () => {
    const tasks: Promise<unknown>[] = [];
    const err = console.error; console.error = () => {};
    await afterOrderCreated({ orderId: ORDER_ID, context: ctx, saveContext: async () => { throw new Error("db down"); },
      deliver: async () => { throw new Error("meta down"); }, schedule: (t) => { tasks.push(t()); } });
    await Promise.all(tasks); console.error = err;
  });
});

describe("transport and security", () => {
  const original = globalThis.fetch;
  const savedToken = process.env.META_CAPI_ACCESS_TOKEN;
  afterEach(() => {
    globalThis.fetch = original;
    if (savedToken === undefined) delete process.env.META_CAPI_ACCESS_TOKEN; else process.env.META_CAPI_ACCESS_TOKEN = savedToken;
  });
  const event: MetaEvent = { event_name: "Purchase", event_time: 1, event_id: "o", action_source: "website", user_data: {}, custom_data: {} };

  test("the access token is sent in the body, never in the URL, and never logged", async () => {
    process.env.META_CAPI_ACCESS_TOKEN = "SECRET_TOKEN_abcdef123456"; let url = ""; let body = ""; const logs: string[] = [];
    const err = console.error; console.error = (...a: unknown[]) => logs.push(a.join(" "));
    globalThis.fetch = (async (u: string, init: RequestInit) => { url = u; body = String(init.body); return new Response('{"error":{"code":100,"message":"SECRET_TOKEN_abcdef123456"}}', { status: 400 }); }) as typeof fetch;
    const result = await sendMetaEvent(event); console.error = err;
    assert.ok(!url.includes("access_token") && !url.includes("SECRET_TOKEN")); assert.equal(JSON.parse(body).access_token, "SECRET_TOKEN_abcdef123456");
    assert.deepEqual(result, { ok: false, retryable: false, reason: "HTTP_400_CODE_100" }); assert.ok(!logs.join(" ").includes("SECRET_TOKEN"));
  });

  test("error classification: 5xx / 429 / transient code retryable, other 4xx permanent", async () => {
    process.env.META_CAPI_ACCESS_TOKEN = "tok_1234567890abcdef";
    const cases: [number, string, boolean][] = [[500, "{}", true], [503, "<html>", true], [429, "{}", true], [400, '{"error":{"code":4}}', true], [400, '{"error":{"code":190}}', true], [400, '{"error":{"code":100}}', false], [404, "{}", false]];
    const err = console.error; console.error = () => {};
    for (const [status, text, retryable] of cases) {
      globalThis.fetch = (async () => new Response(text, { status })) as typeof fetch;
      const r = await sendMetaEvent(event); assert.equal(r.ok, false); assert.equal((r as { retryable: boolean }).retryable, retryable, `${status} ${text}`);
    }
    console.error = err;
  });

  test("when not configured, no request is made", async () => {
    delete process.env.META_CAPI_ACCESS_TOKEN; let called = false; globalThis.fetch = (async () => { called = true; return new Response("{}"); }) as typeof fetch;
    const r = await sendMetaEvent(event); assert.equal(called, false); assert.equal(r.ok, false);
  });

  test("user_data is hashed once and raw PII is absent", () => {
    const u = buildPurchaseEvent(makeRow(), makeOrder(), null, T0 + 1).user_data as Record<string, string[]>;
    assert.deepEqual(u.ph, [sha256("201012345678")]); assert.deepEqual(u.fn, [sha256("sara")]); assert.deepEqual(u.ln, [sha256("ali")]);
    assert.deepEqual(u.ct, [sha256("cairo")]); assert.deepEqual(u.country, [sha256("eg")]); assert.deepEqual(u.em, [ctx.em]);
    const json = JSON.stringify(u); assert.ok(!json.includes("01012345678") && !json.includes("a@b.com") && !json.includes("Sara"));
  });

  test("the cron endpoint auth fails closed", () => {
    const secret = "a-long-enough-secret-123";
    assert.equal(isAuthorizedCron(`Bearer ${secret}`, secret), true);
    assert.equal(isAuthorizedCron("Bearer wrong-secret-of-same-len", secret), false);
    assert.equal(isAuthorizedCron(null, secret), false); assert.equal(isAuthorizedCron(`Bearer ${secret}`, undefined), false);
    assert.equal(isAuthorizedCron("Bearer short", "short"), false); assert.equal(isAuthorizedCron("", ""), false);
  });
});
