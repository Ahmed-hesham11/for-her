import { notFound } from "next/navigation";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { Pagination } from "@/components/admin/pagination";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { getAdminAuditLog } from "@/lib/admin/audit";
import { getAdminUserById } from "@/lib/admin/users";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROLE_LABELS_AR: Record<string, string> = {
  admin: "أدمن",
  super_admin: "سوبر أدمن",
};

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const searchParamsValue = await searchParams;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const user = await getAdminUserById(supabase, id);
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    notFound();
  }

  const page = Math.max(1, Number(searchParamsValue.page) || 1);
  const log = await getAdminAuditLog(supabase, { actorId: id, page, pageSize: 30 });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">{ROLE_LABELS_AR[user.role] ?? user.role}</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">{user.full_name || "—"}</h1>
        <p className="mt-1 text-sm text-[#7a6762]">{user.email || user.phone_1 || "—"}</p>
      </div>

      {log.error ? (
        <ErrorState message={`تعذّر تحميل سجلّ النشاط: ${log.error}`} />
      ) : (
        <DashboardSection title={`${log.total} عملية مسجّلة`}>
          <AuditLogTable entries={log.entries} />
          <Pagination page={log.page} pageSize={log.pageSize} total={log.total} basePath={`/admin/users/${id}`} searchParams={searchParamsValue} />
        </DashboardSection>
      )}
    </div>
  );
}
