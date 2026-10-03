import { WhatsAppIcon } from "@/components/icons";
import type { AdminOrderDetail, AdminOrderItem } from "@/lib/admin/orders";
import { formatEgp } from "@/lib/currency";

// The store's own WhatsApp contact number (same one in the site footer's
// social links) — printed on the invoice so the courier/customer has a
// number to reach the store on, distinct from the customer's own phone
// already shown below.
const STORE_WHATSAPP_DISPLAY = "+20 103 510 9074";

// One order, one invoice. `className` lets a multi-order print page add a
// page break after each sheet (see app/admin/orders/print/page.tsx).
export function InvoiceSheet({ order, items, className = "" }: { order: AdminOrderDetail; items: AdminOrderItem[]; className?: string }) {
  return (
    <div className={`rounded-[20px] border border-[#eadfd7] bg-white p-8 shadow-[0_18px_50px_rgba(64,39,31,0.08)] print:rounded-none print:border-0 print:shadow-none ${className}`}>
      <div className="flex items-start justify-between border-b border-[#eadfd7] pb-6">
        <div>
          <p className="brand-serif text-[1.9rem] leading-none text-[#1d1918]">FOR HER</p>
          <p className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-[#4a7a5c]">
            <WhatsAppIcon className="h-3.5 w-3.5" />
            {STORE_WHATSAPP_DISPLAY}
          </p>
        </div>
        <div className="text-left text-sm text-[#4a4442]">
          <p className="font-semibold text-[#221d1b]">طلب #{order.order_number ?? order.id.slice(0, 8)}</p>
          <p className="text-[#8a7c78]">{new Date(order.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mt-4 rounded-[14px] border border-[#e7c9c1] bg-[#fdf3f1] p-4 text-sm text-[#7a3a32]">
        <p className="font-semibold">يُسمح بفتح الشحنة أمام مندوب التوصيل فقط، ويُمنع دخول العميل بالمنتج داخل المنزل إلا بعد سداد قيمة الطلب بالكامل. (ممنوع القياس)</p>
      </div>

      <div className="mt-6 space-y-1 text-sm text-[#2b201d]">
        <p className="font-medium">{order.customer_name}</p>
        <p>{order.phone_1}{order.phone_2 ? ` / ${order.phone_2}` : ""}</p>
        <p>{order.governorate} — {order.address}</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-[14px] border border-[#eadfd7]">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-[#eadfd7] bg-[#f7f1ee] text-[0.66rem] uppercase tracking-[0.08em] text-[#8a7c78]">
              <th className="px-3 py-3 font-medium">المنتج</th>
              <th className="px-3 py-3 font-medium">الرمز</th>
              <th className="px-3 py-3 font-medium">الكمية</th>
              <th className="px-3 py-3 font-medium">سعر الوحدة</th>
              <th className="px-3 py-3 font-medium">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eadfd7]">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-[#f1e7e0]">
                      {item.image_url ? (
                        // Product images can come from any host (Supabase Storage or external), not just the allow-listed next/image hosts.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <span className="font-medium text-[#221d1b]">{item.product_name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-[#8a7c78]">{item.sku ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-3 text-[#4a4442]">{item.quantity}</td>
                <td className="whitespace-nowrap px-3 py-3 text-[#4a4442]">{formatEgp(item.unit_price)}</td>
                <td className="whitespace-nowrap px-3 py-3 font-medium text-[#221d1b]">{formatEgp(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-[280px] space-y-2 text-sm text-[#4a4442]">
          <div className="flex justify-between"><span>الإجمالي الفرعي</span><span>{formatEgp(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>الخصم</span><span>-{formatEgp(order.discount)}</span></div>
          <div className="flex justify-between"><span>الشحن</span><span>{formatEgp(order.shipping_fee)}</span></div>
          <div className="flex justify-between border-t border-[#eadfd7] pt-2 text-base font-semibold text-[#1d1918]"><span>الإجمالي</span><span>{formatEgp(order.total_amount)}</span></div>
        </div>
      </div>
    </div>
  );
}
