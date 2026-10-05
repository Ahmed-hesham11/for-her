import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();

  return <AdminShell adminName={profile.full_name} adminRole={profile.role}>{children}</AdminShell>;
}
