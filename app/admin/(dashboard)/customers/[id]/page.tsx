import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { EmptyState, ErrorState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { getAdminCustomerDetail, getCustomerOrders } from "@/lib/admin/customers";
import { formatEgp } from "@/lib/currency";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const customer = await getAdminCustomerDetail(supabase, id);
  if (!customer) {
    notFound();
  }

  const orders = await getCustomerOrders(supabase, id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">
          <Link href="/admin/customers" className="hover:text-[#1d1a19]">العملاء</Link> / {customer.full_name || customer.email}
        </p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">{customer.full_name || "عميل بدون اسم"}</h1>
        <p className="mt-1 text-sm text-[#8a7c78]">انضم في {new Date(customer.created_at).toLocaleDateString()}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-5">
          <p className="text-[0.68rem] uppercase tracking-[0.14em] text-[#8a7c78]">إجمالي الطلبات</p>
          <p className="mt-2 text-2xl font-semibold text-[#1d1918]">{customer.order_count}</p>
        </div>
        <div className="rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-5">
          <p className="text-[0.68rem] uppercase tracking-[0.14em] text-[#8a7c78]">إجمالي الإنفاق</p>
          <p className="mt-2 text-2xl font-semibold text-[#1d1918]">{formatEgp(customer.total_spent)}</p>
        </div>
        <div className="rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-5">
          <p className="text-[0.68rem] uppercase tracking-[0.14em] text-[#8a7c78]">البريد الإلكتروني</p>
          <p className="mt-2 truncate text-sm font-medium text-[#1d1918]">{customer.email}</p>
        </div>
      </div>

      <DashboardSection title="الملف الشخصي">
        <div className="grid gap-3 text-sm text-[#4a4442] sm:grid-cols-2">
          <p><span className="font-medium text-[#221d1b]">الهاتف:</span> {customer.phone_1 || "—"}{customer.phone_2 ? ` / ${customer.phone_2}` : ""}</p>
          <p><span className="font-medium text-[#221d1b]">المحافظة:</span> {customer.governorate || "—"}</p>
          <p className="sm:col-span-2"><span className="font-medium text-[#221d1b]">العنوان:</span> {customer.address || "—"}</p>
        </div>
      </DashboardSection>

      <DashboardSection title="سجل الطلبات">
        {orders.length === 0 ? (
          <EmptyState title="لا توجد طلبات بعد." description="لم يقم هذا العميل بأي طلبات." />
        ) : (
          <div className="overflow-x-auto rounded-[16px] border border-[#eadfd7]">
            <table className="w-full min-w-[480px] border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-[#eadfd7] bg-[#f7f1ee] text-[0.68rem] uppercase tracking-[0.1em] text-[#8a7c78]">
                  <th className="px-4 py-3 font-medium">الطلب</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium">الإجمالي</th>
                  <th className="px-4 py-3 font-medium">الدفع</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eadfd7]">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-[#221d1b] hover:text-[#b76b5b]">
                        #{order.order_number ?? order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">{formatEgp(order.total_amount)}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={order.payment_status} kind="payment" /></td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={order.status} kind="order" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
