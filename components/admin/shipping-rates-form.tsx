"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminShippingRate } from "@/lib/admin/shipping";
import { updateShippingRatesAction } from "@/lib/admin/actions";

export function ShippingRatesForm({ rates }: { rates: AdminShippingRate[] }) {
  const router = useRouter();
  const [fields, setFields] = useState(() => new Map(rates.map((rate) => [rate.id, { shipping_fee: rate.shipping_fee, is_active: rate.is_active }])));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const update = (id: string, patch: Partial<{ shipping_fee: number; is_active: boolean }>) =>
    setFields((current) => {
      const next = new Map(current);
      const existing = next.get(id);
      if (existing) next.set(id, { ...existing, ...patch });
      return next;
    });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (isSaving) return;
    setIsSaving(true);

    const updates = rates.map((rate) => {
      const field = fields.get(rate.id) ?? { shipping_fee: rate.shipping_fee, is_active: rate.is_active };
      return { id: rate.id, ...field };
    });

    const { error: updateError } = await updateShippingRatesAction(updates);
    setIsSaving(false);

    if (updateError) {
      setError(updateError);
      return;
    }
    setSuccess("تم حفظ أسعار الشحن.");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-6">
      <div className="overflow-x-auto rounded-[16px] border border-[#eadfd7]">
        <table className="w-full min-w-[420px] border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-[#eadfd7] bg-[#f7f1ee] text-[0.68rem] uppercase tracking-[0.1em] text-[#8a7c78]">
              <th className="px-4 py-3 font-medium">المحافظة</th>
              <th className="px-4 py-3 font-medium">سعر الشحن (ج.م)</th>
              <th className="px-4 py-3 font-medium">مفعّلة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eadfd7]">
            {rates.map((rate) => {
              const field = fields.get(rate.id) ?? { shipping_fee: rate.shipping_fee, is_active: rate.is_active };
              return (
                <tr key={rate.id}>
                  <td className="px-4 py-3 font-medium text-[#221d1b]">{rate.governorate}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={field.shipping_fee}
                      onChange={(event) => update(rate.id, { shipping_fee: Number(event.target.value) })}
                      className="w-28 rounded-full border border-[#e4d4cd] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#c8a78f]"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <input
                      type="checkbox"
                      checked={field.is_active}
                      onChange={(event) => update(rate.id, { is_active: event.target.checked })}
                      className="h-4 w-4 accent-[#1d1a19]"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-[#cbe6d5] bg-[#eefaf3] px-3 py-2 text-sm text-[#1e5b3d]">{success}</p> : null}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSaving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
      </button>
    </form>
  );
}
