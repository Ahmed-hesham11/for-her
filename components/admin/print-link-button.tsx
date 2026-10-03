import { PrintIcon } from "@/components/icons";

// Red until the admin actually presses "طباعة" on the print page (see
// PrintInvoiceButton, which sets orders.printed) — green after. Just an
// entry point into that page; this button itself never changes the flag.
export function PrintLinkButton({ orderId, printed, onClick }: { orderId: string; printed: boolean; onClick?: (event: React.MouseEvent) => void }) {
  return (
    <a
      href={`/admin/orders/${orderId}/print`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      title={printed ? "تمت الطباعة — فتح فاتورة الشحن" : "لم تتم الطباعة بعد — فتح فاتورة الشحن"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
        printed ? "bg-[#dcefe1] text-[#296b45] hover:bg-[#cbe6d5]" : "bg-[#f6dcd6] text-[#8a3f34] hover:bg-[#f0c9c1]"
      }`}
    >
      <PrintIcon className="h-4 w-4" />
    </a>
  );
}
