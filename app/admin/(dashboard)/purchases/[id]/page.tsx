import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { getAdminPurchaseById } from "@/lib/admin/purchases";
import { formatEgp } from "@/lib/currency";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminPurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const result = await getAdminPurchaseById(supabase, id);
  if (!result) {
    notFound();
  }

  const { purchase, items } = result;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">
          <Link href="/admin/purchases" className="hover:text-[#1d1a19]">المشتريات</Link> / #{purchase.purchase_number ?? purchase.id.slice(0, 8)}
        </p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">عملية شراء #{purchase.purchase_number ?? purchase.id.slice(0, 8)}</h1>
        <p className="mt-1 text-sm text-[#8a7c78]">{purchase.supplier_name} · {new Date(purchase.purchase_date).toLocaleDateString()}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <DashboardSection title="المنتجات">
          <div className="overflow-x-auto rounded-[16px] border border-[#eadfd7]">
            <table className="w-full min-w-[420px] border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-[#eadfd7] bg-[#f7f1ee] text-[0.68rem] uppercase tracking-[0.1em] text-[#8a7c78]">
                  <th className="px-4 py-3 font-medium">المنتج</th>
                  <th className="px-4 py-3 font-medium">الكمية</th>
                  <th className="px-4 py-3 font-medium">تكلفة الوحدة</th>
                  <th className="px-4 py-3 font-medium">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eadfd7]">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-[#221d1b]">{item.product_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{item.quantity}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{formatEgp(item.unit_cost)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">{formatEgp(item.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        <DashboardSection title="الملخص">
          <div className="space-y-3 text-sm text-[#4a4442]">
            <div className="flex justify-between"><span>المورد</span><span className="font-medium text-[#221d1b]">{purchase.supplier_name}</span></div>
            <div className="flex justify-between"><span>تاريخ الشراء</span><span>{new Date(purchase.purchase_date).toLocaleDateString()}</span></div>
            {purchase.notes ? <div className="flex justify-between gap-4"><span>ملاحظات</span><span className="text-left">{purchase.notes}</span></div> : null}
            <div className="flex justify-between border-t border-[#eadfd7] pt-3 text-base font-semibold text-[#1d1918]"><span>الإجمالي</span><span>{formatEgp(purchase.total_amount)}</span></div>
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
