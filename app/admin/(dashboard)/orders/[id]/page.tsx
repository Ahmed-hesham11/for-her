import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { OrderConfirmToggle } from "@/components/admin/order-confirm-toggle";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { WhatsAppConfirmButton } from "@/components/admin/whatsapp-confirm-button";
import { PrintIcon } from "@/components/icons";
import { getAdminOrderById } from "@/lib/admin/orders";
import { ORDER_SOURCE_LABELS_AR } from "@/lib/admin/status-labels-ar";
import { formatEgp } from "@/lib/currency";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const result = await getAdminOrderById(supabase, id);
  if (!result) {
    notFound();
  }

  const { order, items } = result;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">
            <Link href="/admin/orders" className="hover:text-[#1d1a19]">الطلبات</Link> / #{order.order_number ?? order.id.slice(0, 8)}
          </p>
          <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">طلب #{order.order_number ?? order.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-[#8a7c78]">تم الطلب في {new Date(order.created_at).toLocaleString()}</p>
        </div>
        <a
          href={`/admin/orders/${order.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] transition ${
            order.printed ? "bg-[#dcefe1] text-[#296b45] hover:bg-[#cbe6d5]" : "bg-[#f6dcd6] text-[#8a3f34] hover:bg-[#f0c9c1]"
          }`}
        >
          <PrintIcon className="h-4 w-4" />
          {order.printed ? "تمت الطباعة" : "طباعة فاتورة الشحن"}
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <DashboardSection title="المنتجات">
          <div className="overflow-x-auto rounded-[16px] border border-[#eadfd7]">
            <table className="w-full min-w-[480px] border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-[#eadfd7] bg-[#f7f1ee] text-[0.68rem] uppercase tracking-[0.1em] text-[#8a7c78]">
                  <th className="px-4 py-3 font-medium">المنتج</th>
                  <th className="px-4 py-3 font-medium">الرمز</th>
                  <th className="px-4 py-3 font-medium">الكمية</th>
                  <th className="px-4 py-3 font-medium">سعر الوحدة</th>
                  <th className="px-4 py-3 font-medium">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eadfd7]">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-[#f1e7e0]">
                          {item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- product images can come from any host, not just the allow-listed next/image hosts.
                            <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <span className="font-medium text-[#221d1b]">{item.product_name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{item.sku ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{item.quantity}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{formatEgp(item.unit_price)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">{formatEgp(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        <div className="space-y-6">
          <DashboardSection title="العميل">
            <div className="space-y-2 text-sm text-[#4a4442]">
              <p><span className="font-medium text-[#221d1b]">الاسم:</span> {order.customer_name}</p>
              <p><span className="font-medium text-[#221d1b]">الهاتف:</span> {order.phone_1}{order.phone_2 ? ` / ${order.phone_2}` : ""}</p>
              <p><span className="font-medium text-[#221d1b]">عدد الطلبات:</span> {order.order_count}{order.order_count > 1 ? " (عميل متكرر)" : " (طلب أول مرة)"}</p>
              <p><span className="font-medium text-[#221d1b]">المحافظة:</span> {order.governorate}</p>
              <p><span className="font-medium text-[#221d1b]">العنوان:</span> {order.address}</p>
              <p><span className="font-medium text-[#221d1b]">المصدر:</span> {ORDER_SOURCE_LABELS_AR[order.source] ?? order.source}</p>
            </div>
          </DashboardSection>

          <DashboardSection title="الملخص المالي">
            <div className="space-y-3 text-sm text-[#4a4442]">
              <div className="flex justify-between"><span>الإجمالي الفرعي</span><span>{formatEgp(order.subtotal)}</span></div>
              <div className="flex justify-between"><span>الخصم</span><span>-{formatEgp(order.discount)}</span></div>
              <div className="flex justify-between"><span>الشحن</span><span>{formatEgp(order.shipping_fee)}</span></div>
              <div className="flex justify-between border-t border-[#eadfd7] pt-3 text-base font-semibold text-[#1d1918]"><span>الإجمالي</span><span>{formatEgp(order.total_amount)}</span></div>
              <div className="flex justify-between pt-2 text-[#4a4442]"><span>طريقة الدفع</span><span className="uppercase">{order.payment_method}</span></div>
            </div>
          </DashboardSection>

          <DashboardSection title="الحالة">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[0.68rem] uppercase tracking-[0.1em] text-[#8a7c78]">تأكيد الطلب</p>
                <div className="flex items-center gap-3">
                  <OrderConfirmToggle orderId={order.id} confirmed={order.confirmed} />
                  <WhatsAppConfirmButton phone={order.phone_1} customerName={order.customer_name} orderNumber={order.order_number} totalAmount={order.total_amount} />
                </div>
              </div>
              <div>
                <p className="mb-2 text-[0.68rem] uppercase tracking-[0.1em] text-[#8a7c78]">حالة الطلب</p>
                <OrderStatusSelect orderId={order.id} value={order.status} kind="order" />
              </div>
              <div>
                <p className="mb-2 text-[0.68rem] uppercase tracking-[0.1em] text-[#8a7c78]">حالة الدفع</p>
                <OrderStatusSelect orderId={order.id} value={order.payment_status} kind="payment" />
              </div>
            </div>
          </DashboardSection>
        </div>
      </div>
    </div>
  );
}
