"use client";

import Link from "next/link";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useCart } from "@/components/cart-provider";
import { AuthGate } from "@/components/auth-gate";
import { useLocale } from "@/components/locale-provider";
import { formatEgp } from "@/lib/currency";

export default function CartPage() {
  const { items, subtotal, isLoading, error, updateQuantity, removeFromCart } = useCart();
  const { t } = useLocale();
  const shipping = 0;
  const discount = 0;
  const total = subtotal + shipping - discount;

  return (
    <AuthGate>
      <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
        <div className="mb-8 text-center">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#7d6d69]">{t.cart.eyebrow}</p>
          <h1 className="brand-serif text-[3rem] leading-none text-[#1d1918]">{t.cart.title}</h1>
        </div>

        {error ? (
          <p className="mb-6 rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-4 py-3 text-sm text-[#7a3a32]">{error}</p>
        ) : null}

        {isLoading ? (
          <p className="py-12 text-center text-sm uppercase tracking-[0.16em] text-[#766a67]">{t.cart.loading}</p>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] border border-[#ebddd5] bg-[#fdf8f5] p-10 text-center">
            <p className="brand-serif text-[2.3rem] leading-none text-[#1d1918]">{t.cart.emptyTitle}</p>
            <p className="mt-3 text-[#675e5b]">{t.cart.emptyBody}</p>
            <Link href="/products" className="mt-6 inline-block rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#332d2b]">
              {t.common.continueShopping}
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.5fr_0.7fr]">
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-4 rounded-[24px] border border-[#ebddd5] bg-[#fdf8f5] p-4 sm:flex-row sm:items-center">
                  <div className="relative h-28 w-full overflow-hidden rounded-[18px] bg-[#f1e7e0] sm:w-28">
                    <Image src={item.image} alt={item.name} fill sizes="(min-width: 640px) 112px, 100vw" className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-medium text-[#221d1b]">{item.name}</h2>
                    <p className="mt-1 text-sm text-[#675e5b]">{formatEgp(item.price)} {t.cart.each}</p>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div className="flex items-center overflow-hidden rounded-full border border-[#e5d7d1] bg-white text-[#2a2221]">
                        <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-10 w-10">−</button>
                        <span className="w-10 text-center">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-10 w-10">+</button>
                      </div>
                      <button type="button" onClick={() => removeFromCart(item.id)} className="text-sm text-[#9b5d50] underline-offset-2 hover:underline">{t.common.remove}</button>
                    </div>
                  </div>
                  <div className="text-left text-xl font-semibold text-[#1d1918] sm:text-right">{formatEgp(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>

            <aside className="rounded-[24px] border border-[#ebddd5] bg-[#f8f1ee] p-5">
              <h2 className="brand-serif text-[2.2rem] leading-none text-[#1d1918]">{t.cart.summary}</h2>
              <div className="mt-6 space-y-4 text-[#534b49]">
                <div className="flex justify-between"><span>{t.common.subtotal}</span><span>{formatEgp(subtotal)}</span></div>
                <div className="flex justify-between border-t border-[#e7d7d2] pt-4 text-base font-semibold text-[#1d1918]"><span>{t.common.total}</span><span>{formatEgp(total)}</span></div>
              </div>
              <Link href="/checkout" className="mt-6 block rounded-full bg-[#1d1a19] px-5 py-3 text-center text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#332d2b]">
                {t.cart.proceedToCheckout}
              </Link>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
      </div>
    </AuthGate>
  );
}
