"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateOrderConfirmedAction } from "@/lib/admin/actions";

export function OrderConfirmToggle({ orderId, confirmed }: { orderId: string; confirmed: boolean }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isSaving) return;

    setIsSaving(true);
    const { error } = await updateOrderConfirmedAction(orderId, !confirmed);
    setIsSaving(false);

    if (!error) router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isSaving}
      className={`inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-medium transition disabled:opacity-60 ${
        confirmed ? "bg-[#dcefe1] text-[#296b45] hover:bg-[#cbe6d5]" : "bg-[#f6e6c8] text-[#7a5b1e] hover:bg-[#f0dbaf]"
      }`}
    >
      {isSaving ? "..." : confirmed ? "تم التأكيد" : "لم يتأكد"}
    </button>
  );
}
