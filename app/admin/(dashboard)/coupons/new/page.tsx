import { CouponForm } from "@/components/admin/coupon-form";

export default function NewCouponPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">التسويق</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">إنشاء كوبون</h1>
      </div>

      <CouponForm />
    </div>
  );
}
