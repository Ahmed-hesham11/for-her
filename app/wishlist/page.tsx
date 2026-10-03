"use client";

import Link from "next/link";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useCartActions } from "@/components/cart-provider";
import { useWishlist } from "@/components/wishlist-provider";
import { AuthGate } from "@/components/auth-gate";
import { useLocale } from "@/components/locale-provider";
import { formatEgp } from "@/lib/currency";

export default function WishlistPage() {
  const { items, isLoading, error, removeFromWishlist } = useWishlist();
  const { addToCart } = useCartActions();
  const { t } = useLocale();

  return (
    <AuthGate>
      <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
        <SiteHeader />
        <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
          <div className="mb-8 text-center">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#7d6d69]">{t.wishlist.eyebrow}</p>
            <h1 className="brand-serif text-[3rem] leading-none text-[#1d1918]">{t.wishlist.title}</h1>
          </div>

          {error ? (
            <p className="mb-6 rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-4 py-3 text-sm text-[#7a3a32]">{error}</p>
          ) : null}

          {isLoading ? (
            <p className="py-12 text-center text-sm uppercase tracking-[0.16em] text-[#766a67]">{t.wishlist.loading}</p>
          ) : items.length === 0 ? (
            <div className="rounded-[24px] border border-[#ebddd5] bg-[#fdf8f5] p-10 text-center">
              <p className="brand-serif text-[2.3rem] leading-none text-[#1d1918]">{t.wishlist.emptyTitle}</p>
              <p className="mt-3 text-[#675e5b]">{t.wishlist.emptyBody}</p>
              <Link href="/products" className="mt-6 inline-block rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#332d2b]">
                {t.common.continueShopping}
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col overflow-hidden rounded-[24px] border border-[#ebddd5] bg-[#fdf8f5]">
                  <Link href={`/product/${item.id}`} className="relative aspect-[4/5] overflow-hidden bg-[#eee5de]">
                    <Image src={item.image} alt={item.name} fill sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                  </Link>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#82716b]">{item.category}</p>
                      <Link href={`/product/${item.id}`} className="mt-1 block text-lg font-medium text-[#221d1b] hover:text-[#a06f5c]">
                        {item.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-[#1d1918]">{formatEgp(item.price)}</span>
                      {item.originalPrice !== null && item.originalPrice > item.price ? (
                        <span className="text-sm text-[#a08d88] line-through">{formatEgp(item.originalPrice)}</span>
                      ) : null}
                    </div>
                    <div className="mt-auto flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        disabled={item.stock === 0}
                        className="flex-1 rounded-full bg-[#1d1a19] px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {item.stock === 0 ? t.common.outOfStock : t.common.addToCart}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromWishlist(item.id)}
                        className="rounded-full border border-[#e5d7d1] px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#594947] transition hover:border-[#c9a99d] hover:text-[#9b5d50]"
                      >
                        {t.common.remove}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <SiteFooter />
      </div>
    </AuthGate>
  );
}
