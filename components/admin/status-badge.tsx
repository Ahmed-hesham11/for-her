import { ORDER_STATUS_LABELS_AR, PAYMENT_STATUS_LABELS_AR } from "@/lib/admin/status-labels-ar";

const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: "bg-[#f6e6c8] text-[#7a5b1e]",
  confirmed: "bg-[#dfe9f5] text-[#31567c]",
  processing: "bg-[#e6e0f5] text-[#4e3d80]",
  shipped: "bg-[#d9ecf0] text-[#2a6474]",
  delivered: "bg-[#dcefe1] text-[#296b45]",
  cancelled: "bg-[#f6dcd6] text-[#8a3f34]",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-[#f6e6c8] text-[#7a5b1e]",
  paid: "bg-[#dcefe1] text-[#296b45]",
  failed: "bg-[#f6dcd6] text-[#8a3f34]",
  refunded: "bg-[#e6e0f5] text-[#4e3d80]",
};

export function StatusBadge({ status, kind = "order" }: { status: string; kind?: "order" | "payment" }) {
  const styles = kind === "order" ? ORDER_STATUS_STYLES : PAYMENT_STATUS_STYLES;
  const labels = kind === "order" ? ORDER_STATUS_LABELS_AR : PAYMENT_STATUS_LABELS_AR;
  const normalized = status.toLowerCase();
  const className = styles[normalized] ?? "bg-[#f2e7df] text-[#4a4442]";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-medium tracking-[0.02em] ${className}`}>
      {labels[normalized] ?? status}
    </span>
  );
}
