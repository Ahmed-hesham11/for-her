// In-memory stand-in for Supabase (PostgREST over HTTP) and the Meta Graph API,
// installed as globalThis.fetch. The REAL supabase-js client and the REAL
// lib/meta-outbox-store.ts talk to it, so query construction (filters, lease
// conditions, table/column names) is exercised, not just the logic around it.

export type FakeOutboxRow = {
  id: string; order_id: string; event_name: string; event_id: string; event_time: string; status: string; attempts: number;
  next_attempt_at: string; lease_token: string | null; locked_until: string | null; last_attempt_at: string | null;
  sent_at: string | null; last_error: string | null; context: Record<string, unknown> | null; created_at: string;
};

export type MetaReply = { status: number; body?: unknown } | "timeout" | "network";

export class FakeBackend {
  orders = new Map<string, Record<string, unknown>>();
  orderItems: Record<string, unknown>[] = [];
  outbox: FakeOutboxRow[] = [];
  metaRequests: { url: string; body: { data: Record<string, unknown>[]; access_token?: string; test_event_code?: string } }[] = [];
  metaReplies: MetaReply[] = [];          // consumed in order; empty => 200
  requests: { method: string; url: string }[] = [];
  onMeta: (() => void) | null = null;      // called when a Meta request arrives (before it is answered)
  metaGate: Promise<void> | null = null;   // hold Meta responses until resolved
  clockOffsetMs = 0;                       // simulates time passing for leases / retries
  private seq = 0;

  now() { return Date.now() + this.clockOffsetMs; }
  advance(ms: number) { this.clockOffsetMs += ms; }

  // What the DB trigger + create_secure_order would produce for a storefront order.
  createOrder(opts: { id?: string; total: number; items: { product_id: string | null; quantity: number; unit_price: number }[]; userId?: string | null }) {
    const id = opts.id ?? `00000000-0000-4000-8000-${String(++this.seq).padStart(12, "0")}`;
    const createdAt = new Date(this.now()).toISOString();
    this.orders.set(id, { id, user_id: opts.userId === undefined ? "user-1" : opts.userId, total_amount: opts.total, customer_name: "Sara Ali", phone_1: "01012345678", governorate: "Cairo", created_at: createdAt });
    for (const item of opts.items) this.orderItems.push({ order_id: id, ...item });
    if (opts.userId !== null) this.enqueue(id, createdAt);
    return id;
  }

  enqueue(orderId: string, createdAt: string) {
    if (this.outbox.some((r) => r.order_id === orderId && r.event_name === "Purchase")) return; // unique(order_id,event_name)
    this.outbox.push({ id: `ob-${this.outbox.length + 1}`, order_id: orderId, event_name: "Purchase", event_id: orderId, event_time: createdAt, status: "pending", attempts: 0,
      next_attempt_at: createdAt, lease_token: null, locked_until: null, last_attempt_at: null, sent_at: null, last_error: null, context: null, created_at: createdAt });
  }

  install() {
    const original = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => this.handle(String(input), init ?? {})) as typeof fetch;
    return () => { globalThis.fetch = original; };
  }

  private json(body: unknown, status = 200) {
    return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }

  private async handle(rawUrl: string, init: RequestInit): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    const url = new URL(rawUrl);
    this.requests.push({ method, url: rawUrl });

    if (url.hostname === "graph.facebook.com") return this.handleMeta(rawUrl, init);

    const eq = (key: string) => url.searchParams.get(key)?.replace(/^eq\./, "") ?? null;
    const path = url.pathname.replace("/rest/v1/", "");

    if (method === "GET" && path === "orders") {
      const id = eq("id");
      return this.json([...this.orders.values()].filter((o) => !id || o.id === id));
    }
    if (method === "GET" && path === "order_items") {
      const orderId = eq("order_id");
      return this.json(this.orderItems.filter((i) => !orderId || i.order_id === orderId));
    }
    if (method === "POST" && path === "rpc/claim_meta_events") {
      const args = JSON.parse(String(init.body)) as { p_limit: number; p_lease_seconds: number; p_order_id: string | null };
      const now = this.now();
      const due = this.outbox
        .filter((r) => (!args.p_order_id || r.order_id === args.p_order_id) &&
          ((r.status === "pending" && Date.parse(r.next_attempt_at) <= now) || (r.status === "processing" && Date.parse(r.locked_until ?? "") < now)))
        .slice(0, Math.max(args.p_limit, 1));
      for (const r of due) {
        r.status = "processing"; r.lease_token = `lease-${++this.seq}`; r.locked_until = new Date(now + args.p_lease_seconds * 1000).toISOString();
        r.attempts += 1; r.last_attempt_at = new Date(now).toISOString();
      }
      return this.json(due);
    }
    if (method === "PATCH" && path === "meta_event_outbox") {
      const patch = JSON.parse(String(init.body)) as Partial<FakeOutboxRow>;
      const matches = this.outbox.filter((r) =>
        (eq("id") === null || r.id === eq("id")) &&
        (eq("lease_token") === null || r.lease_token === eq("lease_token")) &&
        (eq("status") === null || r.status === eq("status")) &&
        (eq("order_id") === null || r.order_id === eq("order_id")) &&
        (eq("event_name") === null || r.event_name === eq("event_name")) &&
        (url.searchParams.get("context") !== "is.null" || r.context === null));
      for (const r of matches) Object.assign(r, patch);
      return url.searchParams.has("select") ? this.json(matches.map((r) => ({ id: r.id }))) : this.json(null, 204);
    }
    return this.json({ message: `FakeBackend: unhandled ${method} ${rawUrl}` }, 500);
  }

  private async handleMeta(rawUrl: string, init: RequestInit): Promise<Response> {
    this.metaRequests.push({ url: rawUrl, body: JSON.parse(String(init.body)) });
    this.onMeta?.();
    if (this.metaGate) await this.metaGate;
    const reply = this.metaReplies.shift() ?? { status: 200, body: { events_received: 1 } };
    if (reply === "timeout") throw new DOMException("The operation timed out", "TimeoutError");
    if (reply === "network") throw new TypeError("fetch failed");
    return this.json(reply.body ?? {}, reply.status);
  }
}
