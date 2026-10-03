"use client";

import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import { ProductActiveToggle } from "@/components/admin/product-active-toggle";
import type { AdminProduct } from "@/lib/admin/products";
import { formatEgp } from "@/lib/currency";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80";

export function ProductsTable({ products }: { products: AdminProduct[] }) {
  const router = useRouter();

  if (products.length === 0) {
    return <EmptyState title="لم يتم العثور على منتجات." description="جرّب تعديل البحث أو عوامل التصفية، أو أضف منتجًا جديدًا." />;
  }

  return (
    <AdminTable headers={["الصورة", "المنتج", "الرمز", "الفئة", "سعر الشراء", "سعر البيع", "المخزون", "الحالة", ""]}>
      {products.map((product) => (
        <tr key={product.id} onClick={() => router.push(`/admin/products/${product.id}`)} className="cursor-pointer transition hover:bg-[#faf6f3]">
          <td className="px-4 py-3">
            <div className="h-12 w-12 overflow-hidden rounded-[10px] bg-[#f1e7e0]">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-entered URLs can be from any host, not just the allow-listed images.unsplash.com */}
              <img src={product.image_url || FALLBACK_IMAGE} alt={product.name} className="h-full w-full object-cover" />
            </div>
          </td>
          <td className="px-4 py-3 font-medium text-[#221d1b]">{product.name}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{product.sku}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{product.category_name}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{formatEgp(product.purchase_price)}</td>
          <td className="whitespace-nowrap px-4 py-3 font-medium text-[#221d1b]">{formatEgp(product.selling_price)}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{product.stock_quantity}</td>
          <td className="whitespace-nowrap px-4 py-3" onClick={(event) => event.stopPropagation()}>
            <ProductActiveToggle productId={product.id} isActive={product.is_active} />
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-left">
            <span className="text-[0.68rem] font-medium text-[#4a4442]">← تعديل</span>
          </td>
        </tr>
      ))}
    </AdminTable>
  );
}
