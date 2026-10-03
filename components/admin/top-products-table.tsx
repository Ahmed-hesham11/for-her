import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import type { TopSellingProduct } from "@/lib/admin/data";
import { formatEgp } from "@/lib/currency";

export function TopProductsTable({ products }: { products: TopSellingProduct[] }) {
  if (products.length === 0) {
    return <EmptyState title="لا توجد بيانات مبيعات بعد." description="ستظهر المنتجات الأكثر مبيعًا بمجرد ورود الطلبات." />;
  }

  return (
    <AdminTable headers={["المنتج", "الوحدات المباعة", "الإيرادات"]}>
      {products.map((product) => (
        <tr key={product.product_id} className="transition hover:bg-[#faf6f3]">
          <td className="px-4 py-3">
            <p className="font-medium text-[#221d1b]">{product.product_name}</p>
            {product.sku ? <p className="text-xs text-[#8a7c78]">{product.sku}</p> : null}
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{product.units_sold}</td>
          <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">{formatEgp(product.revenue)}</td>
        </tr>
      ))}
    </AdminTable>
  );
}
