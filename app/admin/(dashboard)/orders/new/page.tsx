import { ErrorState } from "@/components/admin/empty-state";
import { SocialOrderForm } from "@/components/admin/social-order-form";
import { getActiveProductOptions } from "@/lib/admin/products";
import { getAdminShippingRates } from "@/lib/admin/shipping";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function NewSocialOrderPage() {
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const [products, shippingResult] = await Promise.all([
    getActiveProductOptions(supabase),
    getAdminShippingRates(supabase),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">المبيعات</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">تسجيل طلب من سوشيال ميديا</h1>
        <p className="mt-1 text-sm text-[#8a7c78]">للطلبات اللي بتيجي من تعليقات أو رسائل إنستجرام/فيسبوك مش من الموقع مباشرة.</p>
      </div>

      {shippingResult.rates.length === 0 ? (
        <ErrorState message="لا توجد محافظات شحن مُعرّفة بعد." />
      ) : (
        <SocialOrderForm products={products} shippingRates={shippingResult.rates} />
      )}
    </div>
  );
}
