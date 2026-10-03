import { ErrorState } from "@/components/admin/empty-state";
import { PurchaseForm } from "@/components/admin/purchase-form";
import { getProductOptions, getSupplierOptions } from "@/lib/admin/products";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function NewPurchasePage() {
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const [suppliers, products] = await Promise.all([
    getSupplierOptions(supabase),
    getProductOptions(supabase),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">المخزون</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">إنشاء عملية شراء</h1>
      </div>

      {suppliers.length === 0 ? (
        <ErrorState message="لا يوجد موردون بعد. أضف موردًا قبل إنشاء عملية شراء." />
      ) : products.length === 0 ? (
        <ErrorState message="لا توجد منتجات بعد. أضف منتجًا قبل إنشاء عملية شراء." />
      ) : (
        <PurchaseForm suppliers={suppliers} products={products} />
      )}
    </div>
  );
}
