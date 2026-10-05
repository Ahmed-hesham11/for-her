import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { Pagination } from "@/components/admin/pagination";
import { UserFilters } from "@/components/admin/user-filters";
import { UsersTable } from "@/components/admin/users-table";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { getAdminUsers } from "@/lib/admin/users";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { profile } = await requireSuperAdmin();
  const params = await searchParams;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const page = Math.max(1, Number(params.page) || 1);
  const result = await getAdminUsers(supabase, { search: params.search, role: params.role, page, pageSize: 20 });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">الصلاحيات</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">المستخدمون</h1>
      </div>

      <DashboardSection title="عوامل التصفية">
        <UserFilters />
      </DashboardSection>

      {result.error ? (
        <ErrorState message={`تعذّر تحميل المستخدمين: ${result.error}`} />
      ) : (
        <DashboardSection title={`${result.total} مستخدم`}>
          <UsersTable users={result.users} currentUserId={profile.id} />
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/admin/users" searchParams={params} />
        </DashboardSection>
      )}
    </div>
  );
}
