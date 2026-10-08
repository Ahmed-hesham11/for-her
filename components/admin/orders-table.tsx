"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import { OrderConfirmToggle } from "@/components/admin/order-confirm-toggle";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { WhatsAppConfirmButton } from "@/components/admin/whatsapp-confirm-button";
import { PrintLinkButton } from "@/components/admin/print-link-button";
import { PrintIcon } from "@/components/icons";
import type { AdminOrderListItem } from "@/lib/admin/orders";
import { formatEgp } from "@/lib/currency";

export function OrdersTable({ orders }: { orders: AdminOrderListItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (orders.length === 0) {
    return <EmptyState title="لم يتم العثور على طلبات." description="جرّب تعديل البحث أو عوامل التصفية." />;
  }

  const allSelected = orders.every((order) => selected.has(order.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(orders.map((order) => order.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-[14px] border border-[#e4d4cd] bg-[#fbf8f5] px-4 py-2.5">
          <span className="text-[0.72rem] font-medium text-[#4a4442]">{selected.size} طلب محدد</span>
          <a
            href={`/admin/orders/print?ids=${Array.from(selected).join(",")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#1d1a19] px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#332d2b]"
          >
            <PrintIcon className="h-3.5 w-3.5" />
            طباعة المحدد
          </a>
        </div>
      ) : null}

      <AdminTable
        headers={[
          <input key="select-all" type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-[#1d1a19]" aria-label="تحديد الكل" />,
          "الطلب", "العميل", "التاريخ", "العناصر", "الإجمالي الفرعي", "الخصم", "الشحن", "الإجمالي", "تأكيد الطلب", "الحالة", "واتساب", "طباعة",
        ]}
      >
        {orders.map((order) => (
          <tr key={order.id} onClick={() => router.push(`/admin/orders/${order.id}`)} className="cursor-pointer transition hover:bg-[#faf6f3]">
            <td className="whitespace-nowrap px-4 py-3" onClick={(event) => event.stopPropagation()}>
              <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggleOne(order.id)} className="h-4 w-4 accent-[#1d1a19]" aria-label={`تحديد الطلب #${order.order_number ?? order.id.slice(0, 8)}`} />
            </td>
            <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">#{order.order_number ?? order.id.slice(0, 8)}</td>
            <td className="px-4 py-3">
              <p className="flex items-center gap-1.5 text-[#221d1b]">
                {order.customer_name}
                {order.source === "social" ? <span className="rounded-full bg-[#e6e0f5] px-2 py-0.5 text-[0.58rem] font-medium text-[#4e3d80]">سوشيال</span> : null}
              </p>
              <p className="text-xs text-[#8a7c78]">{order.phone_1}</p>
              <p className="text-xs text-[#8a7c78]">{order.order_count > 1 ? `عميل متكرر — ${order.order_count} طلبات` : "طلب أول مرة"}</p>
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{new Date(order.created_at).toLocaleDateString()}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{order.item_count}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{formatEgp(order.subtotal)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{formatEgp(order.discount)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{formatEgp(order.shipping_fee)}</td>
            <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">{formatEgp(order.total_amount)}</td>
            <td className="whitespace-nowrap px-4 py-3" onClick={(event) => event.stopPropagation()}>
              <OrderConfirmToggle orderId={order.id} confirmed={order.confirmed} />
            </td>
            <td className="whitespace-nowrap px-4 py-3" onClick={(event) => event.stopPropagation()}>
              <OrderStatusSelect orderId={order.id} value={order.status} kind="order" />
            </td>
            <td className="whitespace-nowrap px-4 py-3" onClick={(event) => event.stopPropagation()}>
              <WhatsAppConfirmButton phone={order.phone_1} customerName={order.customer_name} orderNumber={order.order_number} totalAmount={order.total_amount} />
            </td>
            <td className="whitespace-nowrap px-4 py-3" onClick={(event) => event.stopPropagation()}>
              <PrintLinkButton orderId={order.id} printed={order.printed} />
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
