"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/admin/orders";
import type { CategoryTreeOption } from "@/lib/admin/products";
import { ORDER_STATUS_LABELS_AR, PAYMENT_STATUS_LABELS_AR } from "@/lib/admin/status-labels-ar";

const SELECT_CLASS = "rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-sm text-[#2f2725] outline-none focus:border-[#c8a78f]";

// Local calendar date, not UTC — toISOString() would roll over a day early
// for anyone west of UTC, letting "today" slip into the disabled range.
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function OrderFilters({ categories }: { categories: CategoryTreeOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const today = todayIso();

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
          placeholder="ابحث برقم الطلب، اسم العميل، أو الهاتف..."
          className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-sm outline-none placeholder:text-[#a89690] focus:border-[#c8a78f]"
        />
      </form>

      <select className={SELECT_CLASS} defaultValue={searchParams.get("status") ?? ""} onChange={(event) => updateParam("status", event.target.value)}>
        <option value="">كل الحالات</option>
        {ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>{ORDER_STATUS_LABELS_AR[status] ?? status}</option>
        ))}
      </select>

      <select className={SELECT_CLASS} defaultValue={searchParams.get("category") ?? ""} onChange={(event) => updateParam("category", event.target.value)}>
        <option value="">كل الفئات</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>

      <select className={SELECT_CLASS} defaultValue={searchParams.get("payment") ?? ""} onChange={(event) => updateParam("payment", event.target.value)}>
        <option value="">كل طرق الدفع</option>
        {PAYMENT_STATUSES.map((status) => (
          <option key={status} value={status}>{PAYMENT_STATUS_LABELS_AR[status] ?? status}</option>
        ))}
      </select>

      <input
        type="date"
        defaultValue={from}
        max={to || today}
        onChange={(event) => updateParam("from", event.target.value)}
        className={SELECT_CLASS}
        aria-label="من تاريخ"
      />
      <input
        type="date"
        defaultValue={to}
        min={from || undefined}
        max={today}
        onChange={(event) => updateParam("to", event.target.value)}
        className={SELECT_CLASS}
        aria-label="إلى تاريخ"
      />
    </div>
  );
}
