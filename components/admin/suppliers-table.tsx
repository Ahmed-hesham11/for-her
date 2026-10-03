"use client";

import { useRouter } from "next/navigation";
import { ActiveToggle } from "@/components/admin/active-toggle";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import type { AdminSupplier } from "@/lib/admin/suppliers";

export function SuppliersTable({ suppliers }: { suppliers: AdminSupplier[] }) {
  const router = useRouter();

  if (suppliers.length === 0) {
    return <EmptyState title="لم يتم العثور على موردين." description="أضف موردًا لبدء ربطه بالمنتجات." />;
  }

  return (
    <AdminTable headers={["الاسم", "الهاتف", "البريد الإلكتروني", "الحالة", ""]}>
      {suppliers.map((supplier) => (
        <tr key={supplier.id} onClick={() => router.push(`/admin/suppliers/${supplier.id}`)} className="cursor-pointer transition hover:bg-[#faf6f3]">
          <td className="px-4 py-3 font-medium text-[#221d1b]">{supplier.name}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{supplier.phone ?? "—"}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{supplier.email ?? "—"}</td>
          <td className="whitespace-nowrap px-4 py-3" onClick={(event) => event.stopPropagation()}>
            <ActiveToggle table="suppliers" id={supplier.id} isActive={supplier.is_active} />
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-left">
            <span className="text-[0.68rem] font-medium text-[#4a4442]">← تعديل</span>
          </td>
        </tr>
      ))}
    </AdminTable>
  );
}
