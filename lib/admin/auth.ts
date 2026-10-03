import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isAdminRole } from "@/lib/admin/roles";

export type AdminProfile = {
  id: string;
  full_name: string;
  role: string;
};

export async function requireAdmin(): Promise<{ profile: AdminProfile; email: string | null }> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminRole(user.role)) {
    redirect("/admin/unauthorized");
  }

  return { profile: { id: user.id, full_name: user.full_name, role: user.role }, email: user.email };
}
