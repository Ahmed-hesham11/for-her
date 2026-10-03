"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TruckIcon } from "@/components/icons";
import { useCartActions } from "@/components/cart-provider";
import { useLocale } from "@/components/locale-provider";
import { WishlistButton } from "@/components/wishlist-button";
import { benefits, type Product } from "@/lib/storefront-data";
import { formatEgp } from "@/lib/currency";

export function ProductDetailClient({
  product,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCartActions();
  const { t } = useLocale();
  const router = useRouter();
  const isOnOffer = product.originalPrice !== null && product.originalPrice > product.price;

  const benefitCopy: Record<string, { title: string; description: string }> = {
    "Free Shipping": { title: t.productDetail.freeShippingTitle, description: t.productDetail.freeShippingDesc },
    "Easy Returns": { title: t.productDetail.easyReturnsTitle, description: t.productDetail.easyReturnsDesc },
    "Secure Payment": { title: t.productDetail.securePaymentTitle, description: t.productDetail.securePaymentDesc },
    "Customer Support": { title: t.productDetail.customerSupportTitle, description: t.productDetail.customerSupportDesc },
  };

  const handleBuyNow = async () => {
    await addToCart(product, quantity);
    router.push("/checkout");
  };

  return (
    <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <div className="mb-8 text-sm text-[#7c6b66]">
          <Link href="/products" className="hover:text-[#b66e64]">{t.productDetail.products}</Link>
          <span className="mx-2">/</span>
          <span>{product.name}</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4 md:grid-cols-[80px_1fr]">
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((imageIndex) => (
                <div key={imageIndex} className="overflow-hidden rounded-[16px] border border-[#ebddd7] bg-[#f5ece7]">
                  <Image src={product.image} alt={`${product.name} view ${imageIndex}`} width={96} height={96} sizes="96px" className="h-20 w-full object-cover md:h-24" />
                </div>
              ))}
            </div>
            <div className="relative min-h-[500px] overflow-hidden rounded-[18px] border border-[#ebddd7] bg-[#f4ece8]">
              <Image src={product.image} alt={product.name} fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[#7c6a66]">{product.category}</p>
                <h1 className="mt-2 brand-serif text-[3rem] leading-none text-[#1d1918]">{product.name}</h1>
              </div>
              <WishlistButton
                product={product}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e5d7d1] bg-white/70 text-[#2b201d] hover:text-[#b66e64]"
                activeClassName="border-[#e5b8ab] text-[#b66e64]"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[2rem] font-semibold text-[#1d1918]">{formatEgp(product.price)}</span>
              {isOnOffer ? (
                <>
                  <span className="text-lg text-[#a08d88] line-through">{formatEgp(product.originalPrice)}</span>
                  <span className="rounded-full bg-[#f3e0dd] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#a35c58]">{t.productDetail.onOffer}</span>
                </>
              ) : null}
            </div>

            <div className="rounded-[18px] border border-[#eaded7] bg-[#f8f1ee] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[#786d6a]">{t.productDetail.sku}</span>
                <span className="text-sm text-[#2f2826]">{product.sku}</span>
              </div>
            </div>

            <p className="text-[1rem] leading-7 text-[#5f5451]">{product.description}</p>

            <div className="flex items-center gap-3">
              <div className="flex items-center overflow-hidden rounded-full border border-[#e5d7d1] bg-white/80">
                <button type="button" onClick={() => setQuantity((prev) => Math.max(1, prev - 1))} className="h-12 w-12 text-xl text-[#2f2725]">−</button>
                <span className="w-12 text-center text-base font-medium text-[#1c1918]">{quantity}</span>
                <button type="button" onClick={() => setQuantity((prev) => prev + 1)} className="h-12 w-12 text-xl text-[#2f2725]">+</button>
              </div>
              <button type="button" onClick={() => addToCart(product, quantity)} className="flex-1 rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#332d2b]" disabled={product.stock === 0}>
                {t.common.addToCart}
              </button>
              <button type="button" onClick={handleBuyNow} disabled={product.stock === 0} className="rounded-full border border-[#221d1b] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#1d1a19] transition hover:bg-[#f6ebe5] disabled:cursor-not-allowed disabled:opacity-50">
                {t.productDetail.buyNow}
              </button>
            </div>

            <div className="grid gap-3 rounded-[18px] border border-[#eaded7] bg-[#faf5f2] p-4 sm:grid-cols-2">
              {benefits.map((benefit) => {
                const copy = benefitCopy[benefit.title] ?? benefit;
                return (
                  <div key={benefit.title} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3e0dd] text-[#a35c58]">
                      <TruckIcon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#2b201d]">{copy.title}</p>
                      <p className="text-xs text-[#6e5f5b]">{copy.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <section className="mt-16">
          <div className="mb-6 text-center">
            <h2 className="brand-serif text-[2.5rem] leading-none text-[#1d1918]">{t.productDetail.relatedProducts}</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((item) => (
              <Link key={item.id} href={`/product/${item.id}`} className="group overflow-hidden rounded-[18px] border border-[#ebddd5] bg-[#fffaf7] p-2 shadow-[0_14px_30px_rgba(45,29,23,0.04)] transition hover:-translate-y-1">
                <Image src={item.image} alt={item.name} width={640} height={448} sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" className="h-56 w-full rounded-[14px] object-cover" />
                <div className="px-2 py-4">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#82716b]">{item.category}</p>
                  <h3 className="mt-2 text-lg font-medium text-[#211d1b]">{item.name}</h3>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-semibold">{formatEgp(item.price)}</span>
                    <span className="text-[0.66rem] uppercase tracking-[0.15em] text-[#1d1a19]">{t.productDetail.view}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
