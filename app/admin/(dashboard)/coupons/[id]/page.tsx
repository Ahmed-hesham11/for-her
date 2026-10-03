import { notFound } from "next/navigation";
import { CouponForm } from "@/components/admin/coupon-form";
import { ErrorState } from "@/components/admin/empty-state";
import { getAdminCouponById } from "@/lib/admin/coupons";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const coupon = await getAdminCouponById(supabase, id);
  if (!coupon) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">التسويق</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918] uppercase">{coupon.code}</h1>
      </div>

      <CouponForm
        couponId={coupon.id}
        usedCount={coupon.used_count}
        initialCoupon={{
          code: coupon.code,
          discount_type: coupon.discount_type as "percentage" | "fixed",
          discount_value: coupon.discount_value,
          min_order_amount: coupon.min_order_amount,
          max_uses: coupon.max_uses,
          expires_at: coupon.expires_at,
          is_active: coupon.is_active,
        }}
      />
    </div>
  );
}
