"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import { setProductStockAction } from "@/lib/admin/actions";
import type { AdminProduct } from "@/lib/admin/products";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80";

function InventoryRow({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const [value, setValue] = useState(String(product.stock_quantity));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const quantity = Number(value);
  const isValid = value.trim() !== "" && Number.isInteger(quantity) && quantity >= 0;
  const isDirty = isValid && quantity !== product.stock_quantity;

  const isOut = product.stock_quantity <= 0;
  const isLow = !isOut && product.stock_quantity <= 5;

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setError("");
    const { error: saveError } = await setProductStockAction(product.id, quantity);
    setIsSaving(false);

    if (saveError) {
      setError(saveError);
      return;
    }
    router.refresh();
  };

  return (
    <tr>
      <td className="px-4 py-3">
        <div className="h-12 w-12 overflow-hidden rounded-[10px] bg-[#f1e7e0]">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-entered URLs can be from any host, not just the allow-listed images.unsplash.com */}
          <img src={product.image_url || FALLBACK_IMAGE} alt={product.name} className="h-full w-full object-cover" />
        </div>
      </td>
      <td className="px-4 py-3 font-medium text-[#221d1b]">{product.name}</td>
      <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{product.sku}</td>
      <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{product.category_name}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-medium ${
            isOut ? "bg-[#f6dcd6] text-[#8a3f34]" : isLow ? "bg-[#f6e6c8] text-[#7a5b1e]" : "bg-[#dcefe1] text-[#296b45]"
          }`}
        >
          {isOut ? "نفد المخزون" : isLow ? "مخزون منخفض" : "متوفر"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSave();
              }
            }}
            className="w-24 rounded-full border border-[#e4d4cd] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#c8a78f]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="rounded-full bg-[#1d1a19] px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "..." : "حفظ"}
          </button>
        </div>
        {error ? <p className="mt-1 text-[0.68rem] text-[#8a3f34]">{error}</p> : null}
      </td>
    </tr>
  );
}

export function InventoryTable({ products }: { products: AdminProduct[] }) {
  if (products.length === 0) {
    return <EmptyState title="لم يتم العثور على منتجات." description="جرّب تعديل البحث أو عوامل التصفية." />;
  }

  return (
    <AdminTable headers={["الصورة", "المنتج", "الرمز", "الفئة", "الحالة", "الكمية الفعلية"]}>
      {products.map((product) => (
        <InventoryRow key={product.id} product={product} />
      ))}
    </AdminTable>
  );
}
