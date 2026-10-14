"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { NewPurchaseItem, SupplierProductLink } from "@/lib/admin/purchases";
import { createPurchaseAction } from "@/lib/admin/actions";
import type { ProductOption } from "@/lib/admin/products";
import { formatEgp } from "@/lib/currency";

const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#c8a78f]";
const LABEL_CLASS = "text-[0.72rem] text-[#7a6762]";

// autoCost: the unit cost was pre-filled from the supplier's agreed price and
// hasn't been typed over — it can follow the supplier/product selection.
type LineItem = NewPurchaseItem & { key: string; autoCost: boolean };

function emptyLine(): LineItem {
  return { key: crypto.randomUUID(), product_id: "", quantity: 1, unit_cost: 0, autoCost: true };
}

export function PurchaseForm({ suppliers, products, links }: { suppliers: ProductOption[]; products: ProductOption[]; links: SupplierProductLink[] }) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const linkPrice = (forSupplierId: string, productId: string) =>
    links.find((link) => link.supplier_id === forSupplierId && link.product_id === productId)?.purchase_price ?? null;
  const isLinked = (productId: string) => Boolean(supplierId) && linkPrice(supplierId, productId) !== null;

  const updateLine = (key: string, patch: Partial<LineItem>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  // The supplier's agreed price is only a convenient default — the admin can
  // always type the actual cost paid, and that is what gets recorded.
  const handleProductChange = (key: string, productId: string) =>
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const price = supplierId ? linkPrice(supplierId, productId) : null;
        return { ...line, product_id: productId, ...(line.autoCost ? { unit_cost: price ?? 0 } : {}) };
      }),
    );

  const handleSupplierChange = (nextSupplierId: string) => {
    setSupplierId(nextSupplierId);
    setLines((current) =>
      current.map((line) =>
        line.autoCost && line.product_id ? { ...line, unit_cost: linkPrice(nextSupplierId, line.product_id) ?? 0 } : line,
      ),
    );
  };

  // Products linked to the chosen supplier come first.
  const sortedProducts = supplierId ? [...products].sort((a, b) => Number(isLinked(b.id)) - Number(isLinked(a.id))) : products;

  const addLine = () => setLines((current) => [...current, emptyLine()]);
  const removeLine = (key: string) => setLines((current) => (current.length > 1 ? current.filter((line) => line.key !== key) : current));

  const total = lines.reduce((sum, line) => sum + line.quantity * line.unit_cost, 0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (isSaving) return;
    setIsSaving(true);

    try {
      const { id, error: createError } = await createPurchaseAction({
        supplier_id: supplierId,
        purchase_date: purchaseDate,
        notes,
        items: lines.map(({ product_id, quantity, unit_cost }) => ({ product_id, quantity, unit_cost })),
      });
      if (createError || !id) throw new Error(createError ?? "تعذّر إنشاء عملية الشراء.");
      router.push("/admin/purchases");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذّر إنشاء عملية الشراء هذه الآن.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>المورد</span>
          <select value={supplierId} onChange={(event) => handleSupplierChange(event.target.value)} className={INPUT_CLASS} required>
            <option value="">اختر مورد</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>تاريخ الشراء</span>
          <input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} className={INPUT_CLASS} required />
        </label>
      </div>

      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>ملاحظات (اختياري)</span>
        <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-[18px] border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]" />
      </label>

      <div>
        <p className={`mb-3 ${LABEL_CLASS}`}>عناصر الشراء</p>
        <div className="space-y-3">
          {lines.map((line) => (
            <div key={line.key} className="grid gap-2 rounded-[16px] border border-[#eadfd7] bg-white p-3 sm:grid-cols-[1fr_100px_120px_auto] sm:items-center">
              <select value={line.product_id} onChange={(event) => handleProductChange(line.key, event.target.value)} className={INPUT_CLASS} required>
                <option value="">اختر منتج</option>
                {sortedProducts.map((product) => (
                  <option key={product.id} value={product.id}>{isLinked(product.id) ? `${product.name} ✓` : product.name}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                step="1"
                value={line.quantity}
                onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })}
                placeholder="الكمية"
                className={INPUT_CLASS}
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.unit_cost}
                onChange={(event) => updateLine(line.key, { unit_cost: Number(event.target.value), autoCost: false })}
                placeholder="تكلفة الوحدة"
                className={INPUT_CLASS}
                required
              />
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                disabled={lines.length === 1}
                className="justify-self-start text-[0.68rem] font-medium text-[#8a3f34] hover:underline disabled:cursor-not-allowed disabled:opacity-40 sm:justify-self-center"
              >
                إزالة
              </button>
              {supplierId && line.product_id && !isLinked(line.product_id) ? (
                <p className="text-xs text-[#8a6a2e] sm:col-span-4">هذا المنتج غير مرتبط بالمورد المختار. يمكنك المتابعة وإدخال التكلفة الفعلية.</p>
              ) : null}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-3 rounded-full border border-[#e4d4cd] px-4 py-2 text-[0.68rem] font-medium text-[#4a4442] transition hover:bg-[#f2e7df]"
        >
          + إضافة سطر
        </button>
      </div>

      <div className="flex justify-between border-t border-[#eadfd7] pt-4 text-base font-semibold text-[#1d1918]">
        <span>الإجمالي</span>
        <span>{formatEgp(total)}</span>
      </div>

      {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSaving ? "جارٍ الإنشاء..." : "إنشاء عملية شراء"}
      </button>
    </form>
  );
}
