"use client";

import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import type { AdminPurchaseListItem } from "@/lib/admin/purchases";
import { formatEgp } from "@/lib/currency";

export function PurchasesTable({ purchases }: { purchases: AdminPurchaseListItem[] }) {
  const router = useRouter();

  if (purchases.length === 0) {
    return <EmptyState title="لم يتم العثور على مشتريات." description="أنشئ عملية شراء لتسجيل المخزون الوارد من مورد." />;
  }

  return (
    <AdminTable headers={["عملية الشراء", "المورد", "التاريخ", "الإجمالي", "الحالة"]}>
      {purchases.map((purchase) => (
        <tr key={purchase.id} onClick={() => router.push(`/admin/purchases/${purchase.id}`)} className="cursor-pointer transition hover:bg-[#faf6f3]">
          <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">#{purchase.purchase_number ?? purchase.id.slice(0, 8)}</td>
          <td className="px-4 py-3 text-[#4a4442]">{purchase.supplier_name}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{new Date(purchase.purchase_date).toLocaleDateString()}</td>
          <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">{formatEgp(purchase.total_amount)}</td>
          <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={purchase.status} kind="order" /></td>
        </tr>
      ))}
    </AdminTable>
  );
}
