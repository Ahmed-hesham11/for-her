import Link from "next/link";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { SimpleSearch } from "@/components/admin/simple-search";
import { SuppliersTable } from "@/components/admin/suppliers-table";
import { getAdminSuppliers } from "@/lib/admin/suppliers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const { suppliers, error } = await getAdminSuppliers(supabase, params.search);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">التوريد</p>
          <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">الموردين</h1>
        </div>
        <Link
          href="/admin/suppliers/new"
          className="inline-flex items-center justify-center rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b]"
        >
          إضافة مورد
        </Link>
      </div>

      <DashboardSection title="بحث">
        <SimpleSearch placeholder="ابحث باسم المورد..." />
      </DashboardSection>

      {error ? (
        <ErrorState message={`تعذّر تحميل الموردين: ${error}`} />
      ) : (
        <DashboardSection title={`${suppliers.length} مورد`}>
          <SuppliersTable suppliers={suppliers} />
        </DashboardSection>
      )}
    </div>
  );
}
