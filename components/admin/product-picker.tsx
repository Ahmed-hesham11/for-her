"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductPricedOption } from "@/lib/admin/products";
import { formatEgp } from "@/lib/currency";

// Native <select> can't render images inside <option> in any browser — this
// is a plain button + absolute list standing in for one, so each row in the
// dropdown can show the product's thumbnail, not just its name.
export function ProductPicker({ products, value, onChange }: { products: ProductPricedOption[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = products.find((product) => product.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 rounded-full border border-[#e4d4cd] bg-white px-3 py-2 text-sm outline-none focus:border-[#c8a78f]"
      >
        <span className="h-7 w-7 shrink-0 overflow-hidden rounded-[6px] bg-[#f1e7e0]">
          {selected?.image_url ? (
            // Product images can come from any host (Supabase Storage or external), not just the allow-listed next/image hosts.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.image_url} alt={selected.name} className="h-full w-full object-cover" />
          ) : null}
        </span>
        <span className={`flex-1 truncate text-right ${selected ? "text-[#2b201d]" : "text-[#8a7c78]"}`}>{selected ? selected.name : "اختر منتج"}</span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-[14px] border border-[#e4d4cd] bg-white shadow-[0_12px_30px_rgba(64,39,31,0.12)]">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                onChange(product.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition hover:bg-[#f7f1ee] ${product.id === value ? "bg-[#f2e7df]" : ""}`}
            >
              <span className="h-8 w-8 shrink-0 overflow-hidden rounded-[6px] bg-[#f1e7e0]">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-[#2b201d]">{product.name}</span>
              <span className="shrink-0 text-[0.68rem] text-[#8a7c78]">{formatEgp(product.selling_price)} · {product.stock_quantity} بالمخزون</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
