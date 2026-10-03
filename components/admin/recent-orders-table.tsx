"use client";

import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import type { RecentOrder } from "@/lib/admin/data";
import { formatEgp } from "@/lib/currency";

export function RecentOrdersTable({ orders }: { orders: RecentOrder[] }) {
  const router = useRouter();

  if (orders.length === 0) {
    return <EmptyState title="لم يتم العثور على طلبات." description="ستظهر الطلبات الجديدة هنا عند إتمام العملاء عمليات الشراء." />;
  }

  return (
    <AdminTable headers={["الطلب", "العميل", "التاريخ", "الإجمالي", "الدفع", "الحالة"]}>
      {orders.map((order) => (
        <tr
          key={order.id}
          onClick={() => router.push(`/admin/orders/${order.id}`)}
          className="cursor-pointer transition hover:bg-[#faf6f3]"
        >
          <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">#{order.order_number ?? order.id.slice(0, 8)}</td>
          <td className="px-4 py-3 text-[#4a4442]">{order.customer_name}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{new Date(order.created_at).toLocaleDateString()}</td>
          <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">{formatEgp(order.total_amount)}</td>
          <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={order.payment_status} kind="payment" /></td>
          <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={order.status} kind="order" /></td>
        </tr>
      ))}
    </AdminTable>
  );
}
