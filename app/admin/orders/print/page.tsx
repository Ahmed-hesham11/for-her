import { notFound } from "next/navigation";
import Link from "next/link";
import { InvoiceGridPage } from "@/components/admin/invoice-grid";
import { PrintInvoiceButton } from "@/components/admin/print-invoice-button";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOrdersByIds } from "@/lib/admin/orders";
import { supabaseAdmin } from "@/lib/supabase/admin";

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// Bulk counterpart to /admin/orders/[id]/print — prints several selected
// orders in one job, 4 different orders per A4 sheet (cut along the dashed
// lines), one sheet per page. Deliberately outside the (dashboard) route
// group for the same reason as the single-order print page: no sidebar/nav
// in the printout.
export default async function BulkOrderPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireAdmin();

  const { ids } = await searchParams;
  const orderIds = (ids ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (orderIds.length === 0) notFound();

  const supabase = supabaseAdmin;
  if (!supabase) notFound();

  const results = await getAdminOrdersByIds(supabase, orderIds);
  if (results.length === 0) notFound();

  const pages = chunk(results, 4);

  return (
    <div className="min-h-screen bg-[#f3ece7] px-4 py-10 print:bg-white print:p-0">
      <style>{"@page { size: A4; margin: 8mm; }"}</style>

      <div className="mx-auto max-w-[820px] print:max-w-none">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link href="/admin/orders" className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[#8a7c78] hover:text-[#1d1a19]">← رجوع للطلبات</Link>
          <PrintInvoiceButton orderIds={results.map(({ order }) => order.id)} />
        </div>

        <div className="space-y-6 print:space-y-0">
          {pages.map((pageOrders, index) => (
            <InvoiceGridPage key={pageOrders[0].order.id} orders={pageOrders} className={index < pages.length - 1 ? "print:break-after-page" : ""} />
          ))}
        </div>
      </div>
    </div>
  );
}
