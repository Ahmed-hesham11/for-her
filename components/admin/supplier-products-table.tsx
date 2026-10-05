"use client";

import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import type { SuppliedProduct } from "@/lib/admin/purchases";

export function SupplierProductsTable({ products }: { products: SuppliedProduct[] }) {
  const router = useRouter();

  if (products.length === 0) {
    return <EmptyState title="لا توجد منتجات من هذا المورد بعد." description="تظهر المنتجات هنا بعد تسجيل أول عملية شراء من هذا المورد." />;
  }

  return (
    <AdminTable headers={["المنتج", "SKU", "عدد مرات الشراء", "إجمالي الكمية", "آخر عملية شراء", "الحالة"]}>
      {products.map((product) => (
        <tr key={product.product_id} onClick={() => router.push(`/admin/products/${product.product_id}`)} className="cursor-pointer transition hover:bg-[#faf6f3]">
          <td className="px-4 py-3 font-medium text-[#221d1b]">{product.product_name}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{product.sku || "—"}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{product.purchase_count}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{product.total_quantity}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{product.last_purchase_date ? new Date(product.last_purchase_date).toLocaleDateString("ar-EG") : "—"}</td>
          <td className="whitespace-nowrap px-4 py-3">
            {product.is_active ? (
              <span className="inline-flex items-center rounded-full bg-[#dcefe1] px-3 py-1 text-[0.68rem] font-medium text-[#296b45]">نشط</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[#f2e7df] px-3 py-1 text-[0.68rem] font-medium text-[#4a4442]">غير نشط</span>
            )}
          </td>
        </tr>
      ))}
    </AdminTable>
  );
}
