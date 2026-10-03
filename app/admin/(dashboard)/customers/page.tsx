import { CustomersTable } from "@/components/admin/customers-table";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { Pagination } from "@/components/admin/pagination";
import { SimpleSearch } from "@/components/admin/simple-search";
import { getAdminCustomers } from "@/lib/admin/customers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const page = Math.max(1, Number(params.page) || 1);
  const result = await getAdminCustomers(supabase, { search: params.search, page, pageSize: 20 });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">الأشخاص</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">العملاء</h1>
      </div>

      <DashboardSection title="بحث">
        <SimpleSearch placeholder="ابحث بالاسم أو البريد الإلكتروني..." />
      </DashboardSection>

      {result.error ? (
        <ErrorState message={`تعذّر تحميل العملاء: ${result.error}`} />
      ) : (
        <DashboardSection title={`${result.total} عميل`}>
          <CustomersTable customers={result.customers} />
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/admin/customers" searchParams={params} />
        </DashboardSection>
      )}
    </div>
  );
}
