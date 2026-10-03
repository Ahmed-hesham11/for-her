import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";
import { ErrorState } from "@/components/admin/empty-state";
import { getAdminCategoryById, getTopLevelCategoryOptions } from "@/lib/admin/categories";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const [category, parentOptions] = await Promise.all([
    getAdminCategoryById(supabase, id),
    getTopLevelCategoryOptions(supabase, id),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">الكتالوج</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">{category.name}</h1>
        <p className="mt-1 text-sm text-[#8a7c78]">{category.product_count} منتج</p>
      </div>

      <CategoryForm
        categoryId={category.id}
        parentOptions={parentOptions}
        initialCategory={{
          name: category.name,
          image_url: category.image_url ?? "",
          is_active: category.is_active,
          parent_id: category.parent_id,
        }}
      />
    </div>
  );
}
