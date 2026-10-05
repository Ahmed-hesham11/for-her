import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminUserRole = "customer" | "admin" | "super_admin";

export type AdminUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone_1: string | null;
  role: AdminUserRole;
  created_at: string;
};

export type UserListParams = {
  search?: string;
  role?: string;
  page?: number;
  pageSize?: number;
};

export type UserListResult = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  error: string | null;
};

export async function getAdminUsers(supabase: SupabaseClient, params: UserListParams = {}): Promise<UserListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 20;

  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: params.search?.trim() || null,
    p_role: params.role || null,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) return { users: [], total: 0, page, pageSize, error: error.message };

  const rows = (data ?? []) as (AdminUser & { total_count: number })[];

  return {
    users: rows.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      phone_1: row.phone_1,
      role: row.role,
      created_at: row.created_at,
    })),
    total: Number(rows[0]?.total_count ?? 0),
    page,
    pageSize,
    error: null,
  };
}

// admin_set_user_role raises these as plain exception messages (see
// supabase/migrations/20261006010000_admin_user_roles.sql) — map them to
// Arabic here so the dashboard doesn't surface a raw error code.
const ROLE_ERROR_MESSAGES: Record<string, string> = {
  INVALID_ROLE: "دور غير صالح.",
  SUPER_ADMIN_ONLY: "هذا الإجراء متاح للسوبر أدمن فقط.",
  CANNOT_CHANGE_OWN_ROLE: "لا يمكنك تغيير دورك الخاص.",
  USER_NOT_FOUND: "المستخدم غير موجود.",
  CANNOT_MODIFY_SUPER_ADMIN: "لا يمكن تغيير دور سوبر أدمن من هنا — غيّره يدويًا من Supabase لو لازم.",
};

function mapRoleError(message: string): string {
  return ROLE_ERROR_MESSAGES[message] ?? "تعذّر تحديث الدور الآن.";
}

export async function setUserRole(
  supabase: SupabaseClient,
  actorId: string,
  targetId: string,
  newRole: "customer" | "admin",
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_actor_id: actorId,
    p_target_id: targetId,
    p_new_role: newRole,
  });

  if (error) return { error: mapRoleError(error.message) };
  return { error: null };
}
