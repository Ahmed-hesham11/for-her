import { ProductForm } from "@/components/admin/product-form";
import { ErrorState } from "@/components/admin/empty-state";
import { getCategoryOptions } from "@/lib/admin/products";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function NewProductPage() {
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const categories = await getCategoryOptions(supabase);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">الكتالوج</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">إضافة منتج</h1>
      </div>

      <ProductForm categories={categories} />
    </div>
  );
}
