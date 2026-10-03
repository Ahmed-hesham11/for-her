"use client";

import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import type { AdminCustomer } from "@/lib/admin/customers";
import { formatEgp } from "@/lib/currency";

export function CustomersTable({ customers }: { customers: AdminCustomer[] }) {
  const router = useRouter();

  if (customers.length === 0) {
    return <EmptyState title="لم يتم العثور على عملاء." description="يظهر العملاء هنا بمجرد تسجيل أحدهم في المتجر." />;
  }

  return (
    <AdminTable headers={["الاسم", "البريد الإلكتروني", "الهاتف", "المحافظة", "الطلبات", "إجمالي الإنفاق"]}>
      {customers.map((customer) => (
        <tr key={customer.id} onClick={() => router.push(`/admin/customers/${customer.id}`)} className="cursor-pointer transition hover:bg-[#faf6f3]">
          <td className="px-4 py-3 font-medium text-[#221d1b]">{customer.full_name || "—"}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{customer.email}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{customer.phone_1 || "—"}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{customer.governorate || "—"}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{customer.order_count}</td>
          <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">{formatEgp(customer.total_spent)}</td>
        </tr>
      ))}
    </AdminTable>
  );
}
