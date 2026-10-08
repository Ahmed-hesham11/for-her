import type { SupabaseClient } from "@supabase/supabase-js";

// Arabic display labels for admin_audit_log.entity_type — the stored value
// is never translated, only what's shown in the Users detail page is.
export const AUDIT_ENTITY_LABELS_AR: Record<string, string> = {
  product: "منتج",
  category: "فئة",
  coupon: "كوبون",
  supplier: "مورد",
  purchase: "عملية شراء",
  shipping_rate: "سعر شحن",
  order: "طلب",
  user: "مستخدم",
  image: "صورة",
};

export type AuditLogEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
};

// Called from lib/admin/actions.ts right after a write succeeds — never
// before, so a logging failure can't be mistaken for the write itself
// failing. A logging failure here is swallowed (left for Supabase logs to
// surface) rather than thrown, since losing one audit row is far less
// disruptive than failing the admin action that triggered it.
export async function logAdminAction(
  supabase: SupabaseClient,
  actor: { id: string; full_name: string; role: string },
  entry: { action: string; entity_type: string; entity_id: string | null; summary: string },
): Promise<void> {
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_id: actor.id,
    actor_name: actor.full_name || "—",
    actor_role: actor.role,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    summary: entry.summary,
  });
  if (error) console.error("admin_audit_log insert failed:", error.message);
}

export async function getAdminAuditLog(
  supabase: SupabaseClient,
  params: { actorId: string; page?: number; pageSize?: number },
): Promise<{ entries: AuditLogEntry[]; total: number; page: number; pageSize: number; error: string | null }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 30;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("admin_audit_log")
    .select("id, action, entity_type, entity_id, summary, created_at", { count: "exact" })
    .eq("actor_id", params.actorId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { entries: [], total: 0, page, pageSize, error: error.message };
  return { entries: (data ?? []) as AuditLogEntry[], total: count ?? 0, page, pageSize, error: null };
}
