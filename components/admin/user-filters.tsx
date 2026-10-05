"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SELECT_CLASS = "rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-sm text-[#2f2725] outline-none focus:border-[#c8a78f]";

export function UserFilters() {
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
        className="min-w-[200px] flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          updateParam("search", search);
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث بالاسم، البريد، أو الهاتف..."
          className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-sm outline-none placeholder:text-[#a89690] focus:border-[#c8a78f]"
        />
      </form>

      <select className={SELECT_CLASS} defaultValue={searchParams.get("role") ?? ""} onChange={(event) => updateParam("role", event.target.value)}>
        <option value="">كل الأدوار</option>
        <option value="customer">عملاء</option>
        <option value="admin">أدمنز</option>
        <option value="super_admin">سوبر أدمن</option>
      </select>
    </div>
  );
}
