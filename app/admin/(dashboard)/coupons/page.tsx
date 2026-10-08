import Link from "next/link";
import { CouponsTable } from "@/components/admin/coupons-table";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { SimpleSearch } from "@/components/admin/simple-search";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { getAdminCoupons } from "@/lib/admin/coupons";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const { coupons, error } = await getAdminCoupons(supabase, params.search);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">التسويق</p>
          <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">الكوبونات</h1>
        </div>
        <Link
          href="/admin/coupons/new"
          className="inline-flex items-center justify-center rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b]"
        >
          إنشاء كوبون
        </Link>
      </div>

      <DashboardSection title="بحث">
        <SimpleSearch placeholder="ابحث بكود الكوبون..." />
      </DashboardSection>

      {error ? (
        <ErrorState message={`تعذّر تحميل الكوبونات: ${error}`} />
      ) : (
        <DashboardSection title={`${coupons.length} كوبون`}>
          <CouponsTable coupons={coupons} />
        </DashboardSection>
      )}
    </div>
  );
}
