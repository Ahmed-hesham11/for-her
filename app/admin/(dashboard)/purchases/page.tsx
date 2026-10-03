import Link from "next/link";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { Pagination } from "@/components/admin/pagination";
import { PurchasesTable } from "@/components/admin/purchases-table";
import { PURCHASE_STATUS_LABELS_AR } from "@/lib/admin/status-labels-ar";
import { getAdminPurchases, PURCHASE_STATUSES } from "@/lib/admin/purchases";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminPurchasesPage({
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
  const result = await getAdminPurchases(supabase, { status: params.status, page, pageSize: 20 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">المخزون</p>
          <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">المشتريات</h1>
        </div>
        <Link
          href="/admin/purchases/new"
          className="inline-flex items-center justify-center rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b]"
        >
          إنشاء عملية شراء
        </Link>
      </div>

      <DashboardSection title="تصفية حسب الحالة">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/purchases" className={`rounded-full border px-4 py-2 text-[0.68rem] tracking-[0.08em] ${!params.status ? "border-[#1d1a19] bg-[#1d1a19] text-white" : "border-[#e4d4cd] text-[#4a4442] hover:bg-[#f2e7df]"}`}>
            الكل
          </Link>
          {PURCHASE_STATUSES.map((status) => (
            <Link
              key={status}
              href={`/admin/purchases?status=${status}`}
              className={`rounded-full border px-4 py-2 text-[0.68rem] tracking-[0.08em] ${params.status === status ? "border-[#1d1a19] bg-[#1d1a19] text-white" : "border-[#e4d4cd] text-[#4a4442] hover:bg-[#f2e7df]"}`}
            >
              {PURCHASE_STATUS_LABELS_AR[status] ?? status}
            </Link>
          ))}
        </div>
      </DashboardSection>

      {result.error ? (
        <ErrorState message={`تعذّر تحميل المشتريات: ${result.error}`} />
      ) : (
        <DashboardSection title={`${result.total} عملية شراء`}>
          <PurchasesTable purchases={result.purchases} />
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/admin/purchases" searchParams={params} />
        </DashboardSection>
      )}
    </div>
  );
}
