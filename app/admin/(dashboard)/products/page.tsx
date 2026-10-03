import Link from "next/link";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { Pagination } from "@/components/admin/pagination";
import { ProductFilters } from "@/components/admin/product-filters";
import { ProductsTable } from "@/components/admin/products-table";
import { getAdminProducts, getCategoryOptions, type ActiveFilter, type StockFilter } from "@/lib/admin/products";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SORT_MAP: Record<string, { sortBy: "created_at" | "name" | "selling_price" | "stock_quantity"; sortDir: "asc" | "desc" }> = {
  newest: { sortBy: "created_at", sortDir: "desc" },
  name_asc: { sortBy: "name", sortDir: "asc" },
  price_asc: { sortBy: "selling_price", sortDir: "asc" },
  price_desc: { sortBy: "selling_price", sortDir: "desc" },
  stock_asc: { sortBy: "stock_quantity", sortDir: "asc" },
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const sort = SORT_MAP[params.sort ?? "newest"] ?? SORT_MAP.newest;
  const page = Math.max(1, Number(params.page) || 1);

  const [categories, result] = await Promise.all([
    getCategoryOptions(supabase),
    getAdminProducts(supabase, {
      search: params.search,
      categoryId: params.category,
      active: (params.active as ActiveFilter) ?? "all",
      stock: (params.stock as StockFilter) ?? "all",
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
      page,
      pageSize: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">الكتالوج</p>
          <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">المنتجات</h1>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center justify-center rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b]"
        >
          إضافة منتج
        </Link>
      </div>

      <DashboardSection title="عوامل التصفية">
        <ProductFilters categories={categories} />
      </DashboardSection>

      {result.error ? (
        <ErrorState message={`تعذّر تحميل المنتجات: ${result.error}`} />
      ) : (
        <DashboardSection title={`${result.total} منتج`}>
          <ProductsTable products={result.products} />
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/admin/products" searchParams={params} />
        </DashboardSection>
      )}
    </div>
  );
}
