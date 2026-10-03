import { notFound } from "next/navigation";
import Link from "next/link";
import { InvoiceSheet } from "@/components/admin/invoice-sheet";
import { PrintInvoiceButton } from "@/components/admin/print-invoice-button";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOrderById } from "@/lib/admin/orders";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Deliberately outside the (dashboard) route group — this page skips
// AdminShell (sidebar/nav) entirely so what prints is just the invoice, not
// the whole admin UI. requireAdmin() below is the substitute for the auth
// check the dashboard layout would otherwise have provided.
export default async function OrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const supabase = supabaseAdmin;
  if (!supabase) notFound();

  const result = await getAdminOrderById(supabase, id);
  if (!result) notFound();

  const { order, items } = result;

  return (
    <div className="min-h-screen bg-[#f3ece7] px-4 py-10 print:bg-white print:p-0">
      <style>{"@page { size: A4; margin: 8mm; }"}</style>

      <div className="mx-auto max-w-[820px] print:max-w-none">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link href={`/admin/orders/${order.id}`} className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[#8a7c78] hover:text-[#1d1a19]">← رجوع لتفاصيل الطلب</Link>
          <PrintInvoiceButton orderIds={[order.id]} />
        </div>

        <InvoiceSheet order={order} items={items} />
      </div>
    </div>
  );
}
