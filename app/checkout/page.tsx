"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useCart } from "@/components/cart-provider";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";
import { formatEgp } from "@/lib/currency";

type OrderQuote = { subtotal: number; discount: number; shipping_fee: number; total_amount: number };
type OrderResult = OrderQuote & { order_id: string; order_number: string | null };
type ApiResponse = { error?: string; quote?: OrderQuote; order?: OrderResult };

function money(value: number | undefined) {
  return value === undefined ? "--" : formatEgp(value);
}

export default function CheckoutPage() {
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const { t } = useLocale();
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [isPlaced, setIsPlaced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [error, setError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneSecondary, setPhoneSecondary] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [address, setAddress] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "card">("cod");
  const [requestId] = useState(() => typeof crypto !== "undefined" ? crypto.randomUUID() : "checkout-request");
  const [governorates, setGovernorates] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!user) { setIsLoadingProfile(false); return; }
      const response = await fetch("/api/account");
      const body = await response.json().catch(() => null);
      if (!active) return;
      const data = body?.profile;
      if (data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone_1 ?? "");
        setPhoneSecondary(data.phone_2 ?? "");
        setGovernorate(data.governorate ?? "");
        setAddress(data.address ?? "");
      }
      setIsLoadingProfile(false);
    }
    void loadProfile();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    let active = true;
    async function loadGovernorates() {
      const response = await fetch("/api/shipping-rates");
      const body = await response.json().catch(() => null);
      if (active && body?.governorates) setGovernorates(body.governorates as string[]);
    }
    void loadGovernorates();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (items.length === 0) { setQuote(null); return; }
    let active = true;
    async function loadQuote() {
      setIsLoadingQuote(true); setQuoteError("");
      try {
        if (!user) throw new Error(t.checkout.authRequired);
        const response = await fetch("/api/orders/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })), coupon_code: appliedCoupon, governorate }),
        });
        const result = await response.json() as ApiResponse;
        if (!response.ok || !result.quote) throw new Error(result.error ?? t.checkout.quoteFailure);
        if (active) setQuote(result.quote);
      } catch (quoteFailure) {
        if (active) { setQuote(null); setQuoteError(quoteFailure instanceof Error ? quoteFailure.message : t.checkout.quoteFailure); }
      } finally { if (active) setIsLoadingQuote(false); }
    }
    void loadQuote();
    return () => { active = false; };
  }, [items, appliedCoupon, user, governorate, t]);

  const handlePlaceOrder = async () => {
    setError("");
    if (!fullName.trim() || !phone.trim() || !governorate.trim() || !address.trim()) { setError(t.checkout.completeShippingError); return; }
    if (items.length === 0) { setError(t.checkout.emptyCartError); return; }
    setIsSubmitting(true);
    try {
      if (!user) throw new Error(t.checkout.authRequired);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })), coupon_code: appliedCoupon, customer_name: fullName, phone_1: phone, phone_2: phoneSecondary, governorate, address, payment_method: paymentMethod, request_id: requestId }),
      });
      const result = await response.json() as ApiResponse;
      if (!response.ok || !result.order) throw new Error(result.error ?? t.checkout.orderFailure);
      setOrderResult(result.order); setQuote(result.order); setIsPlaced(true); clearCart();
    } catch (orderFailure) { setError(orderFailure instanceof Error ? orderFailure.message : t.checkout.orderFailure); }
    finally { setIsSubmitting(false); }
  };

  const hasShippingInfo = Boolean(fullName.trim() && phone.trim() && governorate.trim() && address.trim());
  const effectiveShipping = hasShippingInfo ? quote?.shipping_fee ?? 0 : 0;
  const effectiveDiscount = quote && quote.discount > 0 ? quote.discount : 0;
  const summaryAmount = (quote?.subtotal ?? 0) + effectiveShipping - effectiveDiscount;

  const summaryRows = [
    { label: t.common.subtotal, value: money(quote?.subtotal) },
    ...(hasShippingInfo ? [{ label: t.common.shipping, value: money(quote?.shipping_fee) }] : []),
    ...(quote && quote.discount > 0 ? [{ label: t.common.discount, value: `-${money(quote.discount)}` }] : []),
    { label: t.common.total, value: money(summaryAmount), strong: true },
  ];

  return (
    <AuthGate>
      <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]"><SiteHeader /><main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
        <div className="mb-8 text-center"><p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#7d6d69]">{t.checkout.eyebrow}</p><h1 className="brand-serif text-[3rem] leading-none text-[#1d1918]">{t.checkout.title}</h1></div>
        {isPlaced ? <div className="rounded-[24px] border border-[#dfece1] bg-[#eefaf3] p-10 text-center"><p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#3f6f54]">{t.checkout.orderPlacedEyebrow}</p><h2 className="mt-4 brand-serif text-[2.8rem] leading-none text-[#1d1918]">{t.checkout.thankYou}</h2><p className="mt-3 text-[#53675b]">{t.checkout.orderConfirmed(orderResult?.order_number ?? orderResult?.order_id.slice(0, 8) ?? "")}</p><div className="mt-6 flex justify-center gap-3"><Link href="/orders" className="rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white">{t.header.myOrders}</Link><Link href="/products" className="rounded-full border border-[#221d1b] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#1d1a19]">{t.common.continueShopping}</Link></div></div> : <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 rounded-[24px] border border-[#ebddd5] bg-[#fbf7f4] p-5 md:p-6">
            <section><h2 className="mb-4 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-[#766a67]">{t.checkout.shippingInformation}</h2>{isLoadingProfile ? <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[#786d6a]">{t.checkout.loadingSavedInfo}</p> : null}<div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-[#4a4240]"><span>{t.checkout.fullName}</span><input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-full border border-[#e5d7d1] bg-white px-4 py-3 outline-none" required /></label>
              <label className="space-y-2 text-sm text-[#4a4240]"><span>{t.checkout.phone1}</span><input type="text" value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-full border border-[#e5d7d1] bg-white px-4 py-3 outline-none" required /></label>
              <label className="space-y-2 text-sm text-[#4a4240]"><span>{t.checkout.phone2}</span><input type="text" value={phoneSecondary} onChange={(event) => setPhoneSecondary(event.target.value)} className="w-full rounded-full border border-[#e5d7d1] bg-white px-4 py-3 outline-none" /></label>
              <label className="space-y-2 text-sm text-[#4a4240]"><span>{t.checkout.governorate}</span><select value={governorate} onChange={(event) => setGovernorate(event.target.value)} className="w-full rounded-full border border-[#e5d7d1] bg-white px-4 py-3 outline-none" required><option value="" disabled>{t.checkout.selectGovernorate}</option>{governorates.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            </div><label className="mt-4 block space-y-2 text-sm text-[#4a4240]"><span>{t.checkout.address}</span><textarea rows={3} value={address} onChange={(event) => setAddress(event.target.value)} className="w-full rounded-[18px] border border-[#e5d7d1] bg-white px-4 py-3 outline-none" required /></label></section>
            <section><h2 className="mb-4 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-[#766a67]">{t.checkout.paymentMethod}</h2><div className="space-y-3"><label className="flex items-center gap-3 rounded-full border border-[#e8d8d1] bg-white px-4 py-3 text-[#2e2725]"><input type="radio" name="payment" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="accent-[#1d1a19]" />{t.checkout.cashOnDelivery}</label></div></section>
            {error || quoteError ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error || quoteError}</p> : null}
            <section><h2 className="mb-4 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-[#766a67]">{t.checkout.couponCode}</h2><div className="flex gap-3"><input type="text" value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder={t.checkout.couponPlaceholder} className="flex-1 rounded-full border border-[#e5d7d1] bg-white px-4 py-3 outline-none" /><button type="button" onClick={() => setAppliedCoupon(coupon)} disabled={isLoadingQuote} className="rounded-full bg-[#1d1a19] px-5 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#332d2b] disabled:opacity-60">{t.checkout.apply}</button></div><p className="mt-2 text-xs text-[#786d6a]">{t.checkout.couponHint}</p></section>
          </div>
          <aside className="rounded-[24px] border border-[#ebddd5] bg-[#f8f1ee] p-5"><h2 className="brand-serif text-[2.2rem] leading-none text-[#1d1918]">{t.checkout.orderSummary}</h2>{items.length === 0 ? <div className="mt-6 rounded-[18px] border border-[#ebddd5] bg-white/40 p-4 text-sm text-[#625b58]">{t.checkout.emptyCart}</div> : <div className="mt-6 space-y-4 text-[#534b49]">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-full border border-[#eaded7] bg-white/50 px-3 py-2 text-sm"><span>{t.checkout.productXQuantity(item.quantity)}</span><span>{t.checkout.serverPriced}</span></div>)}{summaryRows.map((row) => <div key={row.label} className={`flex justify-between ${row.strong ? "border-t border-[#e7d7d2] pt-4 text-base font-semibold text-[#1d1918]" : ""}`}><span>{row.label}</span><span>{row.value}</span></div>)}{isLoadingQuote ? <p className="text-xs uppercase tracking-[0.14em] text-[#786d6a]">{t.checkout.updatingQuote}</p> : null}</div>}<button type="button" onClick={() => void handlePlaceOrder()} disabled={items.length === 0 || isSubmitting || isLoadingQuote || isLoadingProfile || !quote} className="mt-6 w-full rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? t.checkout.placingOrder : t.checkout.placeOrder}</button><div className="mt-5 text-sm text-[#625b58]">{t.checkout.agreeBefore} <Link href="/" className="font-medium text-[#1d1a19]">{t.checkout.agreeLink}</Link>.</div></aside>
        </div>}
      </main><SiteFooter /></div>
    </AuthGate>
  );
}
