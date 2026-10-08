import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertIcon, BoxIcon, ReceiptIcon, UsersIcon } from "@/components/icons";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { InsightsFilters } from "@/components/admin/insights-filters";
import { KpiCard } from "@/components/admin/kpi-card";
import { LowStockTable } from "@/components/admin/low-stock-table";
import { OrderStatusSummary } from "@/components/admin/order-status-summary";
import { RecentOrdersTable } from "@/components/admin/recent-orders-table";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { TopProductsTable } from "@/components/admin/top-products-table";
import { requireAdmin } from "@/lib/admin/auth";
import { getDashboardOverview } from "@/lib/admin/data";
import { formatEgp } from "@/lib/currency";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // Revenue/profit figures and KPIs are super_admin-only — a plain admin
  // landing on /admin (e.g. the "Admin" link in the site header) goes
  // straight to Orders instead, the page they're actually meant to work in.
  const { profile } = await requireAdmin();
  if (profile.role !== "super_admin") {
    redirect("/admin/orders");
  }

  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase. أضف متغيرات البيئة لتحميل بيانات لوحة التحكم الحية." />;
  }

  const params = await searchParams;
  const hasCustomRange = Boolean(params.from || params.to);

  const { kpis, revenueSummary, revenueProfitByDay, rangeTotals, range, recentOrders, orderStatusCounts, lowStockProducts, topSellingProducts, errors } =
    await getDashboardOverview(supabase, { from: params.from, to: params.to });

  const chartTitle = hasCustomRange ? `الإيرادات والربح (${range.from} إلى ${range.to})` : "الإيرادات والربح (آخر 14 يومًا)";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">نظرة عامة</p>
          <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">لوحة التحكم</h1>
        </div>
        <InsightsFilters />
      </div>

      {errors.length > 0 ? (
        <ErrorState message="تعذّر تحميل بعض بيانات لوحة التحكم — عادةً ما يعني ذلك أن أحد ترحيلات الإدارة في supabase/migrations/ لم يتم تطبيقه بعد. قد تظهر الأرقام أدناه كصفر حتى يتم حل ذلك." />
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="إجمالي الإيرادات (30 يومًا)" value={formatEgp(kpis.totalRevenue)} icon={<ReceiptIcon className="h-4 w-4" />} />
        <KpiCard label="إجمالي الطلبات" value={String(kpis.totalOrders)} icon={<ReceiptIcon className="h-4 w-4" />} />
        <KpiCard label="إجمالي العملاء" value={String(kpis.totalCustomers)} icon={<UsersIcon className="h-4 w-4" />} />
        <KpiCard label="إجمالي المنتجات" value={String(kpis.totalProducts)} icon={<BoxIcon className="h-4 w-4" />} />
        <KpiCard label="الطلبات المعلّقة" value={String(kpis.pendingOrders)} icon={<ReceiptIcon className="h-4 w-4" />} tone="warning" />
        <KpiCard label="منتجات منخفضة المخزون" value={String(kpis.lowStockProducts)} icon={<AlertIcon className="h-4 w-4" />} tone="warning" />
        <KpiCard label="نفد المخزون" value={String(kpis.outOfStockProducts)} icon={<AlertIcon className="h-4 w-4" />} tone="danger" />
        <KpiCard label="المنتجات النشطة" value={String(kpis.activeProducts)} icon={<BoxIcon className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <DashboardSection title={chartTitle}>
          <RevenueChart data={revenueProfitByDay} />
        </DashboardSection>

        <div className="space-y-6">
          <DashboardSection title="ملخص الإيرادات">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#eadfd7] pb-3">
                <span className="text-sm text-[#625b58]">اليوم</span>
                <span className="text-base font-semibold text-[#1d1918]">{formatEgp(revenueSummary.today)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#eadfd7] pb-3">
                <span className="text-sm text-[#625b58]">آخر 7 أيام</span>
                <span className="text-base font-semibold text-[#1d1918]">{formatEgp(revenueSummary.last7Days)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#625b58]">آخر 30 يومًا</span>
                <span className="text-base font-semibold text-[#1d1918]">{formatEgp(revenueSummary.last30Days)}</span>
              </div>
            </div>
          </DashboardSection>

          <DashboardSection title="ملخص الربح (الفترة المحددة)">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#eadfd7] pb-3">
                <span className="text-sm text-[#625b58]">الإيرادات</span>
                <span className="text-base font-semibold text-[#1d1918]">{formatEgp(rangeTotals.revenue)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#eadfd7] pb-3">
                <span className="text-sm text-[#625b58]">تكلفة البضاعة</span>
                <span className="text-base font-semibold text-[#1d1918]">{formatEgp(rangeTotals.cost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#625b58]">الربح</span>
                <span className={`text-base font-semibold ${rangeTotals.profit >= 0 ? "text-[#3f6f54]" : "text-[#8a3f34]"}`}>
                  {formatEgp(rangeTotals.profit)}
                </span>
              </div>
            </div>
          </DashboardSection>
        </div>
      </div>

      <DashboardSection title="نظرة عامة على حالة الطلبات">
        <OrderStatusSummary counts={orderStatusCounts} />
      </DashboardSection>

      <DashboardSection
        title="الطلبات الأخيرة"
        action={
          <Link href="/admin/orders" className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-[#4a4442] hover:text-[#1d1a19]">
            عرض كل الطلبات
          </Link>
        }
      >
        <RecentOrdersTable orders={recentOrders} />
      </DashboardSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardSection title="منتجات منخفضة المخزون">
          <LowStockTable products={lowStockProducts} />
        </DashboardSection>

        <DashboardSection title="المنتجات الأكثر مبيعًا">
          <TopProductsTable products={topSellingProducts} />
        </DashboardSection>
      </div>
    </div>
  );
}
