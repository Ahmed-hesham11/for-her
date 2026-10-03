import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { ShippingRatesForm } from "@/components/admin/shipping-rates-form";
import { getAdminShippingRates } from "@/lib/admin/shipping";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminShippingPage() {
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const { rates, error } = await getAdminShippingRates(supabase);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">التوصيل</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">الشحن</h1>
        <p className="mt-1 text-sm text-[#8a7c78]">حدّد سعر الشحن لكل محافظة. يظهر هذا السعر للعميل تلقائيًا عند اختيار محافظته أثناء الدفع.</p>
      </div>

      {error ? (
        <ErrorState message={`تعذّر تحميل أسعار الشحن: ${error}`} />
      ) : (
        <DashboardSection title={`${rates.length} محافظة`}>
          <ShippingRatesForm rates={rates} />
        </DashboardSection>
      )}
    </div>
  );
}
