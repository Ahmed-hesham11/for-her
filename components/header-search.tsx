"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";

const DELAY_MS = 350;

// Each page renders its own header, so when typing on another page navigates
// to /products the input is re-mounted. This flag lets the new instance take
// focus back so the user can keep typing.
let refocusAfterNavigation = false;

export function HeaderSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const applied = useRef("");

  // Pick up the current term when landing on /products?search=...
  useEffect(() => {
    if (pathname !== "/products") {
      applied.current = "";
      return;
    }
    const current = new URLSearchParams(window.location.search).get("search") ?? "";
    if (current.trim() !== applied.current) {
      applied.current = current.trim();
      setValue(current);
    }
    if (refocusAfterNavigation) {
      refocusAfterNavigation = false;
      const input = inputRef.current;
      if (input) {
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    }
  }, [pathname]);

  const apply = (next: string) => {
    const term = next.trim();
    if (term === applied.current) return;
    applied.current = term;
    if (pathname !== "/products") refocusAfterNavigation = true;

    // Keep the category / sort filters when searching from the products page.
    const params = new URLSearchParams(pathname === "/products" ? window.location.search : "");
    if (term) params.set("search", term);
    else params.delete("search");
    params.delete("page");
    const query = params.toString();
    const href = query ? `/products?${query}` : "/products";
    if (pathname === "/products") router.replace(href, { scroll: false });
    else router.push(href);
  };

  useEffect(() => {
    if (value.trim() === applied.current) return;
    const timer = setTimeout(() => apply(value), DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const term = value.trim();
        if (term === applied.current && pathname === "/products") return;
        // Enter always lands on the results, even for an empty box.
        applied.current = term;
        router.push(term ? `/products?search=${encodeURIComponent(term)}` : "/products");
      }}
      className={`relative ${className}`}
    >
      <SearchIcon className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a7069]" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t.header.searchPlaceholder}
        aria-label={t.header.searchAria}
        className="w-full rounded-full border border-[#e8d7d0] bg-white/70 py-2.5 ps-10 pe-4 text-sm text-[#2f2322] outline-none transition-all duration-300 placeholder:text-[#a99189] focus:border-[#c9a99d] focus:bg-white focus-visible:ring-2 focus-visible:ring-[#d8b9ac]/50"
      />
    </form>
  );
}
