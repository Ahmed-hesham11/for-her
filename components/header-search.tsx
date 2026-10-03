"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";

export function HeaderSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [value, setValue] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = value.trim();
    router.push(term ? `/products?search=${encodeURIComponent(term)}` : "/products");
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a7069]" />
      <input
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
