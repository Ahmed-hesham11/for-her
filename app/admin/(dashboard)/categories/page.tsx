import Link from "next/link";
import { CategoriesTable } from "@/components/admin/categories-table";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { getAdminCategories } from "@/lib/admin/categories";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminCategoriesPage() {
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const { categories, error } = await getAdminCategories(supabase);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">الكتالوج</p>
          <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">الفئات</h1>
        </div>
        <Link
          href="/admin/categories/new"
          className="inline-flex items-center justify-center rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b]"
        >
          إضافة فئة
        </Link>
      </div>

      {error ? (
        <ErrorState message={`تعذّر تحميل الفئات: ${error}`} />
      ) : (
        <DashboardSection title={`${categories.length} فئة`}>
          <CategoriesTable categories={categories} />
        </DashboardSection>
      )}
    </div>
  );
}
