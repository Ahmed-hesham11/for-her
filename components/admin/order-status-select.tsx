"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/admin/orders";
import { updateOrderStatusAction, updatePaymentStatusAction } from "@/lib/admin/actions";
import { ORDER_STATUS_LABELS_AR, PAYMENT_STATUS_LABELS_AR } from "@/lib/admin/status-labels-ar";

export function OrderStatusSelect({ orderId, value, kind }: { orderId: string; value: string; kind: "order" | "payment" }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const options = kind === "order" ? ORDER_STATUSES : PAYMENT_STATUSES;
  const labels = kind === "order" ? ORDER_STATUS_LABELS_AR : PAYMENT_STATUS_LABELS_AR;

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;

    setError("");
    setIsSaving(true);
    const { error: updateError } = kind === "order"
      ? await updateOrderStatusAction(orderId, next)
      : await updatePaymentStatusAction(orderId, next);
    setIsSaving(false);

    if (updateError) {
      setError(updateError);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-1">
      <select
        defaultValue={value}
        onChange={handleChange}
        disabled={isSaving}
        className="rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-sm outline-none focus:border-[#c8a78f] disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option} value={option}>{labels[option] ?? option}</option>
        ))}
      </select>
      {error ? <p className="text-xs text-[#7a3a32]">{error}</p> : null}
    </div>
  );
}
