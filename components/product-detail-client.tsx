"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCartActions } from "@/components/cart-provider";
import { useLocale } from "@/components/locale-provider";
import { WishlistButton } from "@/components/wishlist-button";
import type { Product } from "@/lib/storefront-data";
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
  const discountPercent = isOnOffer ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100) : 0;
  const isOutOfStock = product.stock === 0;
  // Matches the admin dashboard's low-stock threshold (lib/admin/products.ts)
  // — kept as a separate constant here to avoid pulling the admin module
  // (and its Supabase dependency) into the storefront client bundle.
  const isLowStock = product.stock > 0 && product.stock <= 5;

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
          <span>{product.category}</span>
          <span className="mx-2">/</span>
          <span className="text-[#2b201d]">{product.name}</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="group relative min-h-[420px] overflow-hidden rounded-[22px] border border-[#ebddd7] bg-[#f4ece8] shadow-[0_18px_40px_rgba(45,29,23,0.06)] md:min-h-[560px]">
            <Image
              src={product.image}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover transition-transform duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
            />
            {isOnOffer ? (
              <span className="absolute start-4 top-4 rounded-full bg-gradient-to-r from-[#c17a5e] to-[#9c4a37] px-3.5 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.06em] text-white shadow-[0_4px_14px_rgba(156,74,55,0.4)]">
                -{discountPercent}%
              </span>
            ) : null}
            {isOutOfStock ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1d1918]/45 backdrop-blur-[1px]">
                <span className="rounded-full bg-white/95 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#1d1918]">
                  {t.common.outOfStock}
                </span>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[#7c6a66]">{product.category}</p>
                <h1 className="mt-2 brand-serif text-[3rem] leading-none text-[#1d1918]">{product.name}</h1>
              </div>
              <WishlistButton
                product={product}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e5d7d1] bg-white/70 text-[#2b201d] transition-all duration-300 hover:scale-105 hover:border-[#d6b7a8] hover:text-[#b66e64] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] focus-visible:ring-offset-2 active:scale-95"
                activeClassName="border-[#e5b8ab] text-[#b66e64]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className={`text-[2rem] font-semibold ${isOnOffer ? "text-[#9c4a37]" : "text-[#1d1918]"}`}>{formatEgp(product.price)}</span>
              {isOnOffer ? (
                <>
                  <span className="text-lg text-[#a08d88] line-through decoration-[#a08d88]/70 decoration-2">{formatEgp(product.originalPrice)}</span>
                  <span className="rounded-full bg-[#f3e0dd] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#a35c58]">{t.productDetail.onOffer}</span>
                </>
              ) : null}
              {isLowStock ? (
                <span className="rounded-full bg-[#fbeee0] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#9c6a2e]">{t.productDetail.lowStock(product.stock)}</span>
              ) : null}
            </div>

            <div className="rounded-[18px] border border-[#eaded7] bg-[#f8f1ee] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[#786d6a]">{t.productDetail.sku}</span>
                <span className="text-sm text-[#2f2826]">{product.sku}</span>
              </div>
            </div>

            <p className={`text-[1rem] leading-7 ${product.description ? "text-[#5f5451]" : "italic text-[#9c8d88]"}`}>
              {product.description || t.productDetail.noDescription}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center overflow-hidden rounded-full border border-[#e5d7d1] bg-white/80">
                <button type="button" onClick={() => setQuantity((prev) => Math.max(1, prev - 1))} className="h-12 w-12 text-xl text-[#2f2725] transition-colors hover:bg-[#f6ebe5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c]">−</button>
                <span className="w-12 text-center text-base font-medium text-[#1c1918]">{quantity}</span>
                <button type="button" onClick={() => setQuantity((prev) => prev + 1)} className="h-12 w-12 text-xl text-[#2f2725] transition-colors hover:bg-[#f6ebe5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c]">+</button>
              </div>
              <button
                type="button"
                onClick={() => addToCart(product, quantity)}
                disabled={isOutOfStock}
                className="flex-1 rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#332d2b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {t.common.addToCart}
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className="rounded-full border border-[#221d1b] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#1d1a19] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f6ebe5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {t.productDetail.buyNow}
              </button>
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
