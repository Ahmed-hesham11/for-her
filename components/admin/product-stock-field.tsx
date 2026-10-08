"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setProductStockAction } from "@/lib/admin/actions";

// Same immediate-save pattern as the Inventory page's per-row recount
// (setProductStockAction writes stock_quantity directly) — just a second
// place to reach it from, right on the product's own edit page. Saves on
// its own, independent of the rest of the form's "حفظ التغييرات" button.
export function ProductStockField({ productId, currentStock }: { productId: string; currentStock: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentStock));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const quantity = Number(value);
  const isValid = value.trim() !== "" && Number.isInteger(quantity) && quantity >= 0;
  const isDirty = isValid && quantity !== currentStock;

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setError("");
    setSuccess(false);
    const { error: saveError } = await setProductStockAction(productId, quantity);
    setIsSaving(false);

    if (saveError) {
      setError(saveError);
      return;
    }
    setSuccess(true);
    router.refresh();
  };

  return (
    <div className="space-y-1.5 text-sm text-[#4e4442]">
      <span className="text-[0.72rem] text-[#7a6762]">المخزون الحالي</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSuccess(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSave();
            }
          }}
          className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="shrink-0 rounded-full bg-[#1d1a19] px-5 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "..." : "حفظ"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-[#7a3a32]">{error}</p>
      ) : success ? (
        <p className="text-xs text-[#1e5b3d]">تم حفظ الكمية.</p>
      ) : (
        <p className="text-xs text-[#8a7c78]">تصحيح يدوي مباشر — يُحفظ فورًا. يتأثر لاحقًا أيضًا بالمشتريات وطلبات العملاء.</p>
      )}
    </div>
  );
}
