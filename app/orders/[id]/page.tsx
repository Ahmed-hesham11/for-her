import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatEgp } from "@/lib/currency";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/translations";
import { supabaseAdmin } from "@/lib/supabase/admin";

type OrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = getDictionary(await getLocale());
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user || !supabaseAdmin) {
    redirect("/login");
  }

  // Scoped to the authenticated user explicitly — a malformed id or an
  // order belonging to someone else both resolve to the same not-found
  // state, so neither leaks whether the order exists.
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, created_at, status, payment_status, payment_method, customer_name, phone_1, phone_2, governorate, address, subtotal, discount, shipping_fee, total_amount",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("id, product_id, product_name, sku, quantity, unit_price, total_price")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  const orderItems = (items ?? []) as OrderItem[];

  return (
    <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
        <div className="mb-8">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#7d6d69]">{t.orderDetail.eyebrow}</p>
          <h1 className="brand-serif text-[3rem] leading-none text-[#1d1918]">
            #{order.order_number ?? order.id.slice(0, 8)}
          </h1>
          <p className="mt-2 text-sm text-[#786d6a]">{t.orderDetail.placedOn(new Date(order.created_at).toLocaleDateString())}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] border border-[#ebddd5] bg-[#fbf8f5] p-5">
            <h2 className="mb-4 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-[#766a67]">{t.orderDetail.products}</h2>
            {orderItems.length === 0 ? (
              <p className="text-sm text-[#675e5b]">{t.orderDetail.noItems}</p>
            ) : (
              <div className="space-y-4">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 rounded-[18px] border border-[#efdfd8] bg-white p-3">
                    <div className="flex-1">
                      <p className="text-lg font-medium text-[#221d1b]">{item.product_name}</p>
                      <p className="mt-1 text-sm text-[#625d5a]">
                        {item.sku ? `${t.orderDetail.sku}: ${item.sku} · ` : ""}{t.orderDetail.qty}: {item.quantity}
                      </p>
                    </div>
                    <p className="text-base font-semibold text-[#1d1918]">{formatEgp(item.total_price)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-[#ebddd5] bg-[#f8f1ee] p-5">
            <h2 className="mb-4 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-[#766a67]">{t.orderDetail.customerInfo}</h2>
            <div className="space-y-3 text-sm text-[#554d4a]">
              <p><span className="font-medium text-[#1d1918]">{t.orderDetail.name}</span> {order.customer_name}</p>
              <p><span className="font-medium text-[#1d1918]">{t.orderDetail.phone}</span> {order.phone_1}{order.phone_2 ? ` / ${order.phone_2}` : ""}</p>
              <p><span className="font-medium text-[#1d1918]">{t.orderDetail.address}</span> {order.address}, {order.governorate}</p>
              <p><span className="font-medium text-[#1d1918]">{t.orderDetail.payment}</span> {order.payment_method.toUpperCase()} · {order.payment_status}</p>
            </div>

            <div className="mt-6 space-y-4 text-[#534b49]">
              <div className="flex justify-between"><span>{t.common.subtotal}</span><span>{formatEgp(order.subtotal)}</span></div>
              <div className="flex justify-between"><span>{t.common.discount}</span><span>-{formatEgp(order.discount)}</span></div>
              <div className="flex justify-between"><span>{t.common.shipping}</span><span>{formatEgp(order.shipping_fee)}</span></div>
              <div className="flex justify-between border-t border-[#e7d7d2] pt-4 text-base font-semibold text-[#1d1918]"><span>{t.common.total}</span><span>{formatEgp(order.total_amount)}</span></div>
            </div>

            <div className="mt-6 rounded-full bg-[#f1e7df] px-4 py-2 text-center text-[0.7rem] uppercase tracking-[0.15em] text-[#2e2725]">
              {order.status}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
