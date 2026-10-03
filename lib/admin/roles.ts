// "admin" and "super_admin" currently carry identical dashboard permissions —
// super_admin is an org-chart label for now, not a distinct permission tier.
export const ADMIN_ROLES = ["admin", "super_admin"] as const;

export function isAdminRole(role: string | null | undefined): boolean {
  return role != null && (ADMIN_ROLES as readonly string[]).includes(role);
}
