"use client";

import Link from "next/link";
import type { ProductOption } from "@/lib/admin/products";

const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]";
const LABEL_CLASS = "text-[0.72rem] text-[#7a6762]";

// A dropdown to add suppliers one at a time; the chosen ones show below as
// removable tags. Works for a long supplier list.
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
  const selected = selectedIds
    .map((id) => suppliers.find((supplier) => supplier.id === id))
    .filter((supplier): supplier is ProductOption => Boolean(supplier));
  const available = suppliers.filter((supplier) => !selectedIds.includes(supplier.id));

  return (
    <div className="space-y-1.5 text-sm text-[#4e4442]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="product-supplier-select" className={LABEL_CLASS}>الموردون (اختياري — يمكن اختيار أكثر من مورد)</label>
        <Link href="/admin/suppliers/new" target="_blank" className="text-[0.68rem] font-medium text-[#8a5a49] underline-offset-2 hover:underline">
          + مورد جديد
        </Link>
      </div>

      <select
        id="product-supplier-select"
        value=""
        disabled={disabled || available.length === 0}
        onChange={(event) => {
          if (event.target.value) onChange([...selectedIds, event.target.value]);
        }}
        className={INPUT_CLASS}
      >
        <option value="">{available.length === 0 ? "تم اختيار كل الموردين" : "إضافة مورد"}</option>
        {available.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
        ))}
      </select>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pt-1">
          {selected.map((supplier) => (
            <li key={supplier.id} className="flex items-center gap-1.5 rounded-full border border-[#e4d4cd] bg-white py-1 pe-1 ps-3 text-xs text-[#4a4442]">
              <span>{supplier.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(selectedIds.filter((id) => id !== supplier.id))}
                aria-label={`إزالة ${supplier.name}`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[#8a3f34] transition hover:bg-[#f2e7df] disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
