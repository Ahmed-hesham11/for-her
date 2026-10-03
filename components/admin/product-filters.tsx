"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ProductOption } from "@/lib/admin/products";

const SELECT_CLASS = "rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-sm text-[#2f2725] outline-none focus:border-[#c8a78f]";

export function ProductFilters({ categories }: { categories: ProductOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        className="flex-1 min-w-[200px]"
        onSubmit={(event) => {
          event.preventDefault();
          updateParam("search", search);
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث بالاسم أو رمز المنتج..."
          className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-sm outline-none placeholder:text-[#a89690] focus:border-[#c8a78f]"
        />
      </form>

      <select className={SELECT_CLASS} defaultValue={searchParams.get("category") ?? ""} onChange={(event) => updateParam("category", event.target.value)}>
        <option value="">كل الفئات</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>

      <select className={SELECT_CLASS} defaultValue={searchParams.get("active") ?? "all"} onChange={(event) => updateParam("active", event.target.value)}>
        <option value="all">كل الحالات</option>
        <option value="active">نشط</option>
        <option value="inactive">غير نشط</option>
      </select>

      <select className={SELECT_CLASS} defaultValue={searchParams.get("stock") ?? "all"} onChange={(event) => updateParam("stock", event.target.value)}>
        <option value="all">كل حالات المخزون</option>
        <option value="in_stock">متوفر</option>
        <option value="low">مخزون منخفض</option>
        <option value="out">نفد المخزون</option>
      </select>

      <select className={SELECT_CLASS} defaultValue={searchParams.get("sort") ?? "newest"} onChange={(event) => updateParam("sort", event.target.value)}>
        <option value="newest">الأحدث أولاً</option>
        <option value="name_asc">الاسم أ-ي</option>
        <option value="price_asc">السعر: من الأقل للأعلى</option>
        <option value="price_desc">السعر: من الأعلى للأقل</option>
        <option value="stock_asc">المخزون: من الأقل للأعلى</option>
      </select>
    </div>
  );
}
