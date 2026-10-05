import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isAdminRole } from "@/lib/admin/roles";
import { ADMIN_SESSION_HEADER, parseAdminSessionHeader } from "@/lib/auth/session";

export type AdminProfile = {
  id: string;
  full_name: string;
  role: string;
};

export async function requireAdmin(): Promise<{ profile: AdminProfile; email: string | null }> {
  // middleware.ts already verified this request and forwarded the result —
  // reuse it instead of repeating the same session+profile lookup. Falls
  // back to the full check below if the header is missing for any reason,
  // so this is never weaker than a direct DB verification.
  const forwarded = parseAdminSessionHeader((await headers()).get(ADMIN_SESSION_HEADER));
  if (forwarded && isAdminRole(forwarded.role)) {
    return { profile: { id: forwarded.id, full_name: forwarded.full_name, role: forwarded.role }, email: forwarded.email };
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminRole(user.role)) {
    redirect("/admin/unauthorized");
  }

  return { profile: { id: user.id, full_name: user.full_name, role: user.role }, email: user.email };
}

// Same forwarded-header fast path as requireAdmin(), plus a super_admin-only
// gate on top — for pages/actions that can change who else is an admin.
export async function requireSuperAdmin(): Promise<{ profile: AdminProfile; email: string | null }> {
  const result = await requireAdmin();

  if (result.profile.role !== "super_admin") {
    redirect("/admin/unauthorized");
  }

  return result;
}
