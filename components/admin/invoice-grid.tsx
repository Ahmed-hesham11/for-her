import { WhatsAppIcon } from "@/components/icons";
import type { AdminOrderDetail, AdminOrderItem } from "@/lib/admin/orders";
import { formatEgp } from "@/lib/currency";

// Same store WhatsApp number as InvoiceSheet (single-invoice print) — kept
// separate rather than shared because this compact card's font sizes are
// tuned specifically for fitting 4 different orders on one A4 sheet.
const STORE_WHATSAPP_DISPLAY = "+20 103 510 9074";

// Up to 4 DIFFERENT orders, one 2x2 grid per A4 sheet, cut along the dashed
// lines — the batch-printing view (as opposed to InvoiceSheet, which is one
// full-size invoice per page for a single order). Used by the bulk print
// page, which chunks its selected orders into groups of 4 and renders one
// of these per group.
export function InvoiceGridPage({ orders, className = "" }: { orders: { order: AdminOrderDetail; items: AdminOrderItem[] }[]; className?: string }) {
  const cells = [0, 1, 2, 3].map((i) => orders[i] ?? null);

  return (
    <div className={`grid grid-cols-2 grid-rows-2 divide-x divide-y divide-dashed divide-[#d8c6bc] gap-0 rounded-[16px] border border-dashed border-[#d8c6bc] bg-white shadow-[0_18px_50px_rgba(64,39,31,0.08)] print:rounded-none print:border-0 print:shadow-none ${className}`}>
      {cells.map((cell, index) => (
        <div key={cell?.order.id ?? index} className="min-h-[140mm]">{cell ? <CompactInvoiceCard order={cell.order} items={cell.items} /> : null}</div>
      ))}
    </div>
  );
}

function CompactInvoiceCard({ order, items }: { order: AdminOrderDetail; items: AdminOrderItem[] }) {
  return (
    <div className="p-4 text-[11px] leading-tight text-[#2b201d]">
      <div className="flex items-start justify-between border-b border-[#eadfd7] pb-2">
        <div>
          <p className="brand-serif text-[1.3rem] leading-none text-[#1d1918]">FOR HER</p>
          <p className="mt-1 flex items-center gap-1 text-[10px] text-[#4a7a5c]">
            <WhatsAppIcon className="h-3 w-3" />
            {STORE_WHATSAPP_DISPLAY}
          </p>
        </div>
        <div className="text-left">
          <p className="font-semibold text-[#221d1b]">طلب #{order.order_number ?? order.id.slice(0, 8)}</p>
          <p className="text-[#8a7c78]">{new Date(order.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mt-2 rounded-[10px] border border-[#e7c9c1] bg-[#fdf3f1] p-2 text-[#7a3a32]">
        <p className="font-semibold">يُسمح بفتح الشحنة أمام مندوب التوصيل فقط، ويُمنع دخول العميل بالمنتج داخل المنزل إلا بعد سداد قيمة الطلب بالكامل. (ممنوع القياس)</p>
      </div>

      <div className="mt-2 space-y-1">
        <p className="font-medium">{order.customer_name}</p>
        <p>{order.phone_1}{order.phone_2 ? ` / ${order.phone_2}` : ""}</p>
        <p>{order.governorate} — {order.address}</p>
      </div>

      <div className="mt-2 overflow-hidden rounded-[10px] border border-[#eadfd7]">
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="border-b border-[#eadfd7] bg-[#f7f1ee] text-[9.5px] uppercase tracking-[0.04em] text-[#8a7c78]">
              <th className="px-2 py-1.5 font-medium">المنتج</th>
              <th className="px-2 py-1.5 font-medium">كمية</th>
              <th className="px-2 py-1.5 font-medium">سعر</th>
              <th className="px-2 py-1.5 font-medium">إجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eadfd7]">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-[6px] bg-[#f1e7e0]">
                      {item.image_url ? (
                        // Product images can come from any host (Supabase Storage or external), not just the allow-listed next/image hosts.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <span className="font-medium text-[#221d1b]">{item.product_name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-[#4a4442]">{item.quantity}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-[#4a4442]">{formatEgp(item.unit_price)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 font-medium text-[#221d1b]">{formatEgp(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex justify-end">
        <div className="w-full max-w-[150px] space-y-1 text-[#4a4442]">
          <div className="flex justify-between"><span>الفرعي</span><span>{formatEgp(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>خصم</span><span>-{formatEgp(order.discount)}</span></div>
          <div className="flex justify-between"><span>شحن</span><span>{formatEgp(order.shipping_fee)}</span></div>
          <div className="flex justify-between border-t border-[#eadfd7] pt-1 text-[12px] font-semibold text-[#1d1918]"><span>الإجمالي</span><span>{formatEgp(order.total_amount)}</span></div>
        </div>
      </div>
    </div>
  );
}
