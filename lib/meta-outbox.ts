import { buildUserData, type MetaEvent, type MetaSendResult, type OutboxContext } from "@/lib/meta-capi";

// Delivery logic for the meta_event_outbox table (see the 20261031 migration).
// Pure and dependency-injected: the Supabase-backed store lives in
// lib/meta-outbox-store.ts, and tests supply an in-memory one.

export type OutboxRow = {
  id: string;
  order_id: string;
  event_id: string;
  event_time: string;
  attempts: number;
  lease_token: string;
  context: OutboxContext | null;
};

export type OrderSnapshot = {
  id: string;
  user_id: string | null;
  total_amount: number;
  customer_name: string | null;
  phone_1: string | null;
  governorate: string | null;
  items: { product_id: string | null; quantity: number; unit_price: number }[];
};

export interface OutboxStore {
  // Atomically leases due events (and expired leases), incrementing attempts.
  claim(limit: number, leaseSeconds: number, orderId?: string): Promise<OutboxRow[]>;
  loadOrder(orderId: string): Promise<OrderSnapshot | null>;
  // All three return false when the lease was lost to another worker.
  markSent(row: OutboxRow): Promise<boolean>;
  markRetry(row: OutboxRow, nextAttemptAt: Date, error: string): Promise<boolean>;
  markFailed(row: OutboxRow, error: string): Promise<boolean>;
  saveContext(orderId: string, context: OutboxContext): Promise<void>;
}

export const MAX_ATTEMPTS = 12;
// Meta rejects events older than 7 days; stop an hour early to leave margin.
export const MAX_EVENT_AGE_MS = 7 * 24 * 3600_000 - 3600_000;
// Retry delays by attempt number (the last value repeats).
const BACKOFF_SECONDS = [60, 300, 900, 3600, 10_800, 21_600];

export function backoffSeconds(attempt: number) {
  return BACKOFF_SECONDS[Math.min(Math.max(attempt, 1), BACKOFF_SECONDS.length) - 1];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Deterministic: the same row + saved order always yields the same payload.
// event_id and event_time come from the outbox row (order id / orders.created_at),
// never from the send time; value and items come from the saved order.
export function buildPurchaseEvent(row: OutboxRow, order: OrderSnapshot, fallbackSourceUrl: string | null, nowMs: number): MetaEvent {
  const items = order.items.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
  // Item IDs are product ids. Items without one are left out of content_ids.
  const withSku = items.flatMap((item) => {
    const id = item.product_id?.trim();
    const price = Number(item.unit_price);
    return id && Number.isFinite(price) && price >= 0 ? [{ id, quantity: item.quantity, price }] : [];
  });
  const sourceUrl = row.context?.source_url ?? fallbackSourceUrl;

  return {
    event_name: "Purchase",
    // Clamped only against clock skew; otherwise exactly orders.created_at.
    event_time: Math.min(Math.floor(Date.parse(row.event_time) / 1000), Math.floor(nowMs / 1000)),
    event_id: row.event_id,
    action_source: "website",
    ...(sourceUrl ? { event_source_url: sourceUrl } : {}),
    user_data: buildUserData(order, row.context),
    custom_data: {
      currency: "EGP",
      value: round2(order.total_amount),
      content_type: "product",
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      ...(withSku.length > 0
        ? {
            content_ids: withSku.map((item) => item.id),
            contents: withSku.map((item) => ({ id: item.id, quantity: item.quantity, item_price: item.price })),
          }
        : {}),
    },
  };
}

export type OutboxSummary = { claimed: number; sent: number; retried: number; failed: number; leaseLost: number };

export async function processOutbox(options: {
  store: OutboxStore;
  send: (event: MetaEvent) => Promise<MetaSendResult>;
  limit?: number;
  orderId?: string;
  leaseSeconds?: number;
  fallbackSourceUrl?: string | null;
  now?: () => number;
}): Promise<OutboxSummary> {
  const { store, send, orderId, fallbackSourceUrl = null } = options;
  const now = options.now ?? Date.now;
  const summary: OutboxSummary = { claimed: 0, sent: 0, retried: 0, failed: 0, leaseLost: 0 };

  const rows = await store.claim(options.limit ?? 10, options.leaseSeconds ?? 180, orderId);
  summary.claimed = rows.length;

  const record = (applied: boolean, key: "sent" | "retried" | "failed") => {
    if (applied) summary[key] += 1;
    else summary.leaseLost += 1;
  };

  for (const row of rows) {
    try {
      if (now() - Date.parse(row.event_time) > MAX_EVENT_AGE_MS) {
        record(await store.markFailed(row, "EXPIRED"), "failed");
        continue;
      }
      if (row.attempts > MAX_ATTEMPTS) {
        record(await store.markFailed(row, "MAX_ATTEMPTS"), "failed");
        continue;
      }
      const order = await store.loadOrder(row.order_id);
      if (!order) {
        record(await store.markFailed(row, "ORDER_MISSING"), "failed");
        continue;
      }
      if (!Number.isFinite(order.total_amount) || order.total_amount < 0) {
        record(await store.markFailed(row, "INVALID_VALUE"), "failed");
        continue;
      }
      if (order.items.some((item) => !item.product_id?.trim())) {
        console.warn("[meta-outbox] order has item(s) without a product id; excluded from content_ids:", row.order_id);
      }

      const result = await send(buildPurchaseEvent(row, order, fallbackSourceUrl, now()));
      if (result.ok) record(await store.markSent(row), "sent");
      else if (result.retryable) record(await store.markRetry(row, new Date(now() + backoffSeconds(row.attempts) * 1000), result.reason), "retried");
      else record(await store.markFailed(row, result.reason), "failed");
    } catch (error) {
      // Anything unexpected is treated as temporary: the event stays retryable.
      const reason = `EXCEPTION_${error instanceof Error ? error.name : "unknown"}`;
      console.error("[meta-outbox] delivery error:", reason);
      try {
        record(await store.markRetry(row, new Date(now() + backoffSeconds(row.attempts) * 1000), reason), "retried");
      } catch {
        // Lease expiry will make the row claimable again.
      }
    }
  }
  return summary;
}

// Called by the order route after the order is saved. Saves matching context
// (a quick DB write) and then kicks off delivery WITHOUT awaiting it, so the
// customer's response never waits on Meta. The outbox row already exists (made
// by the DB trigger), so if `schedule` never runs, the cron retry delivers it.
export async function afterOrderCreated(deps: {
  orderId: string;
  context: OutboxContext;
  saveContext: (orderId: string, context: OutboxContext) => Promise<void>;
  deliver: (orderId: string) => Promise<unknown>;
  schedule: (task: () => Promise<unknown>) => void;
}) {
  try {
    await deps.saveContext(deps.orderId, deps.context);
  } catch (error) {
    console.error("[meta-outbox] saving context failed:", error instanceof Error ? error.name : "unknown");
  }
  deps.schedule(() => deps.deliver(deps.orderId).catch((error) => {
    console.error("[meta-outbox] fast delivery failed:", error instanceof Error ? error.name : "unknown");
  }));
}
