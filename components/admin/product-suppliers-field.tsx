"use client";

import Link from "next/link";
import type { ProductOption } from "@/lib/admin/products";

// Pick any number of suppliers for the product by toggling their chips.
export function ProductSuppliersField({
  suppliers,
  selectedIds,
  onChange,
  disabled = false,
}: {
  suppliers: ProductOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);

  return (
    <section className="space-y-2" aria-label="موردو المنتج">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.72rem] text-[#7a6762]">الموردون (اختياري — يمكن اختيار أكثر من مورد)</span>
        <Link href="/admin/suppliers/new" target="_blank" className="text-[0.68rem] font-medium text-[#8a5a49] underline-offset-2 hover:underline">
          + مورد جديد
        </Link>
      </div>
      {suppliers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suppliers.map((supplier) => {
            const isSelected = selectedIds.includes(supplier.id);
            return (
              <button
                key={supplier.id}
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => toggle(supplier.id)}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition disabled:opacity-50 ${isSelected ? "border-[#1d1a19] bg-[#1d1a19] text-white" : "border-[#e4d4cd] bg-white text-[#4a4442] hover:bg-[#f2e7df]"}`}
              >
                {supplier.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[#8a7c78]">لا يوجد موردون بعد.</p>
      )}
    </section>
  );
}
