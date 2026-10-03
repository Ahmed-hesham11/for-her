"use client";

import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import type { LowStockProduct } from "@/lib/admin/data";

export function LowStockTable({ products }: { products: LowStockProduct[] }) {
  const router = useRouter();

  if (products.length === 0) {
    return <EmptyState title="لا توجد منتجات منخفضة المخزون." description="جميع المنتجات حاليًا فوق الحد الأدنى للمخزون." />;
  }

  return (
    <AdminTable headers={["المنتج", "الرمز", "المخزون الحالي", "الحالة"]}>
      {products.map((product) => {
        const isOutOfStock = product.stock_quantity <= 0;

        return (
          <tr
            key={product.id}
            onClick={() => router.push(`/admin/products/${product.id}`)}
            className="cursor-pointer transition hover:bg-[#faf6f3]"
          >
            <td className="px-4 py-3 font-medium text-[#221d1b]">{product.name}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{product.sku}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{product.stock_quantity}</td>
            <td className="whitespace-nowrap px-4 py-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-medium ${
                  isOutOfStock ? "bg-[#f6dcd6] text-[#8a3f34]" : "bg-[#f6e6c8] text-[#7a5b1e]"
                }`}
              >
                {isOutOfStock ? "نفد المخزون" : "مخزون منخفض"}
              </span>
            </td>
          </tr>
        );
      })}
    </AdminTable>
  );
}
