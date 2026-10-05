import Link from "next/link";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { OrderFilters } from "@/components/admin/order-filters";
import { OrdersTable } from "@/components/admin/orders-table";
import { Pagination } from "@/components/admin/pagination";
import { getAdminOrders } from "@/lib/admin/orders";
import { getCategoryOptions } from "@/lib/admin/products";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminOrdersPage({
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

  const [categories, result] = await Promise.all([
    getCategoryOptions(supabase),
    getAdminOrders(supabase, {
      search: params.search,
      status: params.status,
      paymentStatus: params.payment,
      categoryId: params.category,
      dateFrom: params.from,
      dateTo: params.to,
      page,
      pageSize: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">المبيعات</p>
          <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">الطلبات</h1>
        </div>
        <Link
          href="/admin/orders/new"
          className="inline-flex items-center justify-center rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b]"
        >
          تسجيل طلب من سوشيال ميديا
        </Link>
      </div>

      <DashboardSection title="عوامل التصفية">
        <OrderFilters categories={categories} />
      </DashboardSection>

      {result.error ? (
        <ErrorState message={`تعذّر تحميل الطلبات: ${result.error}`} />
      ) : (
        <DashboardSection title={`${result.total} طلب`}>
          <OrdersTable orders={result.orders} />
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/admin/orders" searchParams={params} />
        </DashboardSection>
      )}
    </div>
  );
}
