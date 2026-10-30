import { supabaseAdmin } from "@/lib/supabase/admin";
import { processOutbox, type OrderSnapshot, type OutboxRow, type OutboxStore, type OutboxSummary } from "@/lib/meta-outbox";
import { isMetaConfigured, sendMetaEvent, type OutboxContext } from "@/lib/meta-capi";
import { absoluteUrl } from "@/lib/site";

// Supabase-backed OutboxStore. Server-only (service-role client).

function db() {
  if (!supabaseAdmin) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabaseAdmin;
}

// Every state change is conditional on still holding the lease, so a worker
// whose lease expired can't overwrite the result of the worker that took over.
async function finish(row: OutboxRow, patch: Record<string, unknown>) {
  const { data, error } = await db()
    .from("meta_event_outbox")
    .update({ ...patch, lease_token: null, locked_until: null })
    .eq("id", row.id)
    .eq("lease_token", row.lease_token)
    .eq("status", "processing")
    .select("id");
  if (error) throw new Error(`OUTBOX_UPDATE_${error.code ?? "FAILED"}`);
  return (data ?? []).length > 0;
}

export const supabaseOutboxStore: OutboxStore = {
  async claim(limit, leaseSeconds, orderId) {
    const { data, error } = await db().rpc("claim_meta_events", {
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
      p_order_id: orderId ?? null,
    });
    if (error) throw new Error(`OUTBOX_CLAIM_${error.code ?? "FAILED"}`);
    return (data ?? []) as OutboxRow[];
  },

  async loadOrder(orderId): Promise<OrderSnapshot | null> {
    const { data: order, error } = await db()
      .from("orders")
      .select("id, user_id, total_amount, customer_name, phone_1, governorate")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw new Error(`ORDER_READ_${error.code ?? "FAILED"}`);
    if (!order) return null;
    // Saved order lines are the source of truth (SKU and unit_price snapshot at order time).
    const { data: items, error: itemsError } = await db()
      .from("order_items")
      .select("sku, quantity, unit_price")
      .eq("order_id", orderId);
    if (itemsError) throw new Error(`ORDER_ITEMS_READ_${itemsError.code ?? "FAILED"}`);
    return {
      id: order.id as string,
      user_id: (order.user_id as string | null) ?? null,
      total_amount: Number(order.total_amount),
      customer_name: (order.customer_name as string | null) ?? null,
      phone_1: (order.phone_1 as string | null) ?? null,
      governorate: (order.governorate as string | null) ?? null,
      items: (items ?? []).map((item) => ({
        sku: (item.sku as string | null) ?? null,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
    };
  },

  markSent: (row) => finish(row, { status: "sent", sent_at: new Date().toISOString(), last_error: null }),
  markRetry: (row, nextAttemptAt, error) => finish(row, { status: "pending", next_attempt_at: nextAttemptAt.toISOString(), last_error: error }),
  markFailed: (row, error) => finish(row, { status: "failed", last_error: error }),

  async saveContext(orderId: string, context: OutboxContext) {
    // Only fills an empty context on a still-pending event, so a replayed
    // request can't overwrite it or touch an event already delivered.
    const { error } = await db()
      .from("meta_event_outbox")
      .update({ context })
      .eq("order_id", orderId)
      .eq("event_name", "Purchase")
      .eq("status", "pending")
      .is("context", null);
    if (error) throw new Error(`OUTBOX_CONTEXT_${error.code ?? "FAILED"}`);
  },
};

// Entry point for the cron endpoint and the post-order fast path.
export async function runMetaOutbox(options: { limit?: number; orderId?: string } = {}): Promise<OutboxSummary | { skipped: string }> {
  // Unconfigured: leave events pending (no attempt consumed) until the token is set.
  if (!isMetaConfigured()) return { skipped: "META_NOT_CONFIGURED" };
  return processOutbox({ store: supabaseOutboxStore, send: sendMetaEvent, fallbackSourceUrl: absoluteUrl("/checkout"), ...options });
}
