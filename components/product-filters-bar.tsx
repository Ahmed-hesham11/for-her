"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";

const FIELD_CLASS = "h-12 rounded-full border border-[#dfd0c8] bg-[#fffdfb] px-4 text-sm text-[#584f4d] outline-none transition focus:border-[#a06f5c] focus:ring-2 focus:ring-[#d8b9ac]/35";

export const SORT_OPTIONS = ["newest", "price_asc", "price_desc", "name_asc"] as const;

export type SortValue = (typeof SORT_OPTIONS)[number];

export function ProductFiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const sortLabels: Record<SortValue, string> = {
    newest: t.filtersBar.sortNewest,
    price_asc: t.filtersBar.sortPriceAsc,
    price_desc: t.filtersBar.sortPriceDesc,
    name_asc: t.filtersBar.sortNameAsc,
  };

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          updateParam("search", search);
        }}
      >
        <SearchIcon className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b8881]" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.filtersBar.searchPlaceholder}
          className={`${FIELD_CLASS} w-full ps-11`}
          aria-label={t.filtersBar.searchAria}
        />
      </form>

      <select
        value={searchParams.get("sort") ?? "newest"}
        onChange={(event) => updateParam("sort", event.target.value)}
        className={`${FIELD_CLASS} w-full cursor-pointer`}
        aria-label={t.filtersBar.sortAria}
      >
        {SORT_OPTIONS.map((value) => (
          <option key={value} value={value}>{sortLabels[value]}</option>
        ))}
      </select>
    </div>
  );
}
