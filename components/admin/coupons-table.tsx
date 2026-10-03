"use client";

import { useRouter } from "next/navigation";
import { ActiveToggle } from "@/components/admin/active-toggle";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import type { AdminCoupon } from "@/lib/admin/coupons";
import { formatEgp } from "@/lib/currency";

export function CouponsTable({ coupons }: { coupons: AdminCoupon[] }) {
  const router = useRouter();

  if (coupons.length === 0) {
    return <EmptyState title="لم يتم العثور على كوبونات." description="أنشئ كوبونًا لتقديم خصومات عند الدفع." />;
  }

  return (
    <AdminTable headers={["الكود", "الخصم", "الحد الأدنى للطلب", "مرات الاستخدام", "تاريخ الانتهاء", "الحالة", ""]}>
      {coupons.map((coupon) => {
        const isExpired = coupon.expires_at ? new Date(coupon.expires_at) < new Date() : false;
        return (
          <tr key={coupon.id} onClick={() => router.push(`/admin/coupons/${coupon.id}`)} className="cursor-pointer transition hover:bg-[#faf6f3]">
            <td className="px-4 py-3 font-medium uppercase text-[#221d1b]">{coupon.code}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">
              {coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : formatEgp(coupon.discount_value)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{coupon.min_order_amount != null ? formatEgp(coupon.min_order_amount) : "—"}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{coupon.used_count}{coupon.max_uses != null ? ` / ${coupon.max_uses}` : ""}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">
              {coupon.expires_at ? (
                <span className={isExpired ? "text-[#8a3f34]" : undefined}>{new Date(coupon.expires_at).toLocaleDateString()}</span>
              ) : "لا ينتهي"}
            </td>
            <td className="whitespace-nowrap px-4 py-3" onClick={(event) => event.stopPropagation()}>
              <ActiveToggle table="coupons" id={coupon.id} isActive={coupon.is_active} />
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-left">
              <span className="text-[0.68rem] font-medium text-[#4a4442]">← تعديل</span>
            </td>
          </tr>
        );
      })}
    </AdminTable>
  );
}
