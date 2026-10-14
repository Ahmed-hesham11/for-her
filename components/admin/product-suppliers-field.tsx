"use client";

import Link from "next/link";
import type { ProductOption } from "@/lib/admin/products";

// A supplier link being edited. The price stays a string while typing so the
// input behaves normally; it is parsed and validated on save.
export type SupplierDraft = { key: string; supplier_id: string; purchase_price: string };

export function newSupplierDraft(): SupplierDraft {
  return { key: crypto.randomUUID(), supplier_id: "", purchase_price: "" };
}

const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#c8a78f]";

export function ProductSuppliersField({
  suppliers,
  rows,
  onChange,
  disabled = false,
}: {
  suppliers: ProductOption[];
  rows: SupplierDraft[];
  onChange: (rows: SupplierDraft[]) => void;
  disabled?: boolean;
}) {
  const update = (key: string, patch: Partial<SupplierDraft>) => onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const taken = (supplierId: string, key: string) => rows.some((row) => row.key !== key && row.supplier_id === supplierId);

  return (
    <section className="space-y-3 rounded-[16px] border border-[#eadfd7] bg-white/60 p-4" aria-label="موردو المنتج">
      <div>
        <h2 className="text-sm font-semibold text-[#2b201d]">الموردون (اختياري)</h2>
        <p className="mt-0.5 text-xs text-[#8a7c78]">
          يمكن ربط عدة موردين بالمنتج، ولكل مورد سعر شراء خاص به. هذه البيانات داخلية ولا تظهر للعملاء، ولا تغيّر سعر البيع.
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="grid gap-2 rounded-[14px] border border-[#eadfd7] bg-[#fbf8f5] p-2 sm:grid-cols-[1fr_150px_auto] sm:items-center">
              <select
                value={row.supplier_id}
                onChange={(event) => update(row.key, { supplier_id: event.target.value })}
                aria-label="المورد"
                disabled={disabled}
                className={INPUT_CLASS}
              >
                <option value="">اختر مورد</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id} disabled={taken(supplier.id, row.key)}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={row.purchase_price}
                onChange={(event) => update(row.key, { purchase_price: event.target.value })}
                placeholder="سعر الشراء"
                aria-label="سعر الشراء من هذا المورد"
                disabled={disabled}
                className={INPUT_CLASS}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
                className="justify-self-start rounded-full border border-[#e4d4cd] bg-white px-3 py-2 text-[0.68rem] font-medium text-[#8a3f34] transition hover:bg-[#f2e7df] disabled:opacity-50"
              >
                إزالة الربط
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[14px] border border-dashed border-[#e4d4cd] bg-white/60 px-4 py-4 text-center text-xs text-[#8a7c78]">لا يوجد موردون مرتبطون بهذا المنتج.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || rows.length >= suppliers.length}
          onClick={() => onChange([...rows, newSupplierDraft()])}
          className="rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-[0.68rem] font-medium text-[#4a4442] transition hover:bg-[#f2e7df] disabled:opacity-50"
        >
          + ربط مورد
        </button>
        <Link href="/admin/suppliers/new" target="_blank" className="text-[0.68rem] font-medium text-[#8a5a49] underline-offset-2 hover:underline">
          إضافة مورد جديد (يفتح في تبويب جديد)
        </Link>
      </div>
    </section>
  );
}
