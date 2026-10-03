"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { useCartActions } from "@/components/cart-provider";
import { useLocale } from "@/components/locale-provider";
import { WishlistButton } from "@/components/wishlist-button";
import type { Product } from "@/lib/storefront-data";
import { formatEgp } from "@/lib/currency";

// style/className are forwarded to the root <article> so this card can be
// used directly as a StaggerReveal child (see components/reveal.tsx), which
// clones its children with an inline transition style.
export function ProductCard({ product, style, className }: { product: Product; style?: CSSProperties; className?: string }) {
  const { addToCart } = useCartActions();
  const { t } = useLocale();
  const [imageFailed, setImageFailed] = useState(false);
  const isOnOffer = product.originalPrice !== null && product.originalPrice > product.price;
  const discountPercent = isOnOffer ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100) : 0;

  return (
    <article className={`group min-w-0 ${className ?? ""}`} style={style}>
      <div className="relative aspect-[4/5] overflow-hidden bg-[#eee5de]">
        <Link href={`/product/${product.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f2ee]">
          {imageFailed ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-[#eee5de] px-4 text-center text-[#8e766d]" role="img" aria-label={`${product.name} image unavailable`}>
              <span className="brand-serif text-2xl tracking-[0.08em] text-[#92786d]">FOR HER</span>
              <span className="mt-2 text-[0.58rem] font-semibold uppercase tracking-[0.18em]">{t.productCard.imageUnavailable}</span>
            </div>
          ) : (
            // Catalog URLs may come from Supabase Storage hosts outside next/image config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition-transform duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
            />
          )}
        </Link>
        <WishlistButton
          product={product}
          className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-[#fffdfb]/90 text-[#2d201d] opacity-90 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-[#d6b7a8] hover:bg-white hover:text-[#b26b59] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] active:scale-95"
          activeClassName="border-[#d6b7a8] bg-white text-[#b26b59] opacity-100"
        />
        {isOnOffer ? (
          <span className="absolute start-3 top-3 rounded-full bg-gradient-to-r from-[#c17a5e] to-[#9c4a37] px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-white shadow-[0_4px_14px_rgba(156,74,55,0.4)]">
            -{discountPercent}%
          </span>
        ) : null}
      </div>
      <div className="pt-4">
        <Link href={`/product/${product.id}`} className="block focus-visible:outline-none focus-visible:underline">
          <h3 className="truncate text-[0.95rem] font-medium tracking-[0.01em] text-[#2b201d] transition-colors duration-300 group-hover:text-[#a06f5c] md:text-[1.05rem]">{product.name}</h3>
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-[0.98rem] font-semibold md:text-[1.05rem] ${isOnOffer ? "text-[#9c4a37]" : "text-[#1f1b1a]"}`}>{formatEgp(product.price)}</span>
            {isOnOffer ? <span className="text-[0.85rem] font-medium text-[#8b7b76] line-through decoration-[#8b7b76]/70 decoration-2">{formatEgp(product.originalPrice)}</span> : null}
          </div>
          <button
            type="button"
            onClick={() => addToCart(product)}
            className="rounded-full border border-[#221d1b] bg-[#1d1a19] px-3 py-2 text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-[#fffaf7] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#a06f5c] hover:bg-[#a06f5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] focus-visible:ring-offset-2 active:translate-y-0 md:px-3.5 md:text-[0.63rem]"
          >
            {t.common.addToCart}
          </button>
        </div>
      </div>
    </article>
  );
}
