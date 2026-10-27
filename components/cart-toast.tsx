"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCartActions, useCartState } from "@/components/cart-provider";
import { useLocale } from "@/components/locale-provider";

const TOAST_DURATION_MS = 3500;

// Confirmation popup shown after every successful add-to-cart, with a quick
// link to the cart. Re-keyed per add so the timer and animation restart.
export function CartToast() {
  const { lastAdded } = useCartState();
  const { dismissLastAdded } = useCartActions();
  const { t } = useLocale();
  const key = lastAdded?.key;

  useEffect(() => {
    if (key === undefined) return;
    const timer = setTimeout(dismissLastAdded, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [key, dismissLastAdded]);

  if (!lastAdded) return null;

  const details = [lastAdded.colorName, lastAdded.sizeName].filter(Boolean).join(" · ");

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4 md:justify-end md:px-8">
      <div
        key={lastAdded.key}
        role="status"
        aria-live="polite"
        className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-[#e8d7d0] bg-[#fffdfb] p-3 shadow-[0_12px_40px_rgba(45,32,29,0.18)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- catalog URLs can be from any host. */}
        <img src={lastAdded.image} alt="" className="h-14 w-12 shrink-0 rounded-lg bg-[#eee5de] object-cover" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#4f7a5a]">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m4 10.5 4 4 8-9" />
            </svg>
            {t.common.addedToCart}
          </p>
          <p className="truncate text-sm font-medium text-[#2b201d]">{lastAdded.name}</p>
          {details ? <p className="truncate text-xs text-[#7c6b66]">{details}</p> : null}
        </div>
        <Link
          href="/cart"
          onClick={dismissLastAdded}
          className="shrink-0 rounded-full bg-[#1d1a19] px-3.5 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#a06f5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] focus-visible:ring-offset-2"
        >
          {t.common.viewCart}
        </Link>
        <button
          type="button"
          onClick={dismissLastAdded}
          aria-label={t.common.closeAria}
          className="shrink-0 rounded-full p-1 text-[#8e766d] transition-colors hover:text-[#2b201d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c]"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
