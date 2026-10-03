import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/translations";
import { formatEgp } from "@/lib/currency";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Order = {
  id: string;
  order_number: string | null;
  created_at: string;
  total_amount: number;
  payment_status: string;
  status: string;
};

export default async function OrdersPage() {
  const t = getDictionary(await getLocale());
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = supabaseAdmin
    ? await supabaseAdmin
        .from("orders")
        .select("id, order_number, created_at, total_amount, payment_status, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const orders = (data ?? []) as Order[];

  return (
    <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
        <div className="mb-8 text-center">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#7d6d69]">{t.orders.eyebrow}</p>
          <h1 className="brand-serif text-[3rem] leading-none text-[#1d1918]">{t.orders.title}</h1>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-[24px] border border-[#ebddd5] bg-[#fbf8f5] p-10 text-center">
            <p className="brand-serif text-[2.3rem] leading-none text-[#1d1918]">{t.orders.emptyTitle}</p>
            <p className="mt-3 text-[#675e5b]">{t.orders.emptyBody}</p>
            <Link href="/products" className="mt-6 inline-block rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white">{t.orders.startShopping}</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="block rounded-[22px] border border-[#ebddd5] bg-[#fbf8f5] p-5 shadow-[0_12px_28px_rgba(45,29,23,0.03)] transition hover:-translate-y-1">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[#786d6a]">{t.orders.orderNumber(order.order_number ?? order.id.slice(0, 8))}</p>
                    <p className="mt-2 text-sm text-[#5f5451]">{t.orders.placedOn(new Date(order.created_at).toLocaleDateString())}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-[#4d4543]">
                    <span>{t.orders.totalLabel(formatEgp(order.total_amount))}</span>
                    <span>{t.orders.paymentLabel(order.payment_status)}</span>
                    <span className="rounded-full bg-[#f2e7df] px-3 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-[#2d2725]">{order.status}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
