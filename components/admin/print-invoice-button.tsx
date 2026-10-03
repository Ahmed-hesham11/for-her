"use client";

import { PrintIcon } from "@/components/icons";
import { updateOrderPrintedAction } from "@/lib/admin/actions";

export function PrintInvoiceButton({ orderIds }: { orderIds: string[] }) {
  const handlePrint = () => {
    // window.print() has to fire directly from the click's call stack (some
    // browsers block it otherwise) — the printed-flag updates run alongside
    // it, not awaited first, so they never delay the print dialog.
    window.print();
    for (const orderId of orderIds) void updateOrderPrintedAction(orderId, true);
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="print:hidden inline-flex items-center gap-2 rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b]"
    >
      <PrintIcon className="h-4 w-4" />
      طباعة {orderIds.length > 1 ? `(${orderIds.length})` : ""}
    </button>
  );
}
