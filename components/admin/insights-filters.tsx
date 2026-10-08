"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SELECT_CLASS = "rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-sm text-[#2f2725] outline-none focus:border-[#c8a78f]";

// Local calendar date, not UTC — toISOString() would roll over a day early
// for anyone west of UTC, letting "today" slip into the disabled range.
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function InsightsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasRange = Boolean(searchParams.get("from") || searchParams.get("to"));
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const today = todayIso();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[0.68rem] text-[#8a7c78]">
        <span>من</span>
        <input
          type="date"
          defaultValue={from}
          max={to || today}
          onChange={(event) => updateParam("from", event.target.value)}
          className={SELECT_CLASS}
          aria-label="من تاريخ"
        />
      </label>
      <label className="flex flex-col gap-1 text-[0.68rem] text-[#8a7c78]">
        <span>إلى</span>
        <input
          type="date"
          defaultValue={to}
          min={from || undefined}
          max={today}
          onChange={(event) => updateParam("to", event.target.value)}
          className={SELECT_CLASS}
          aria-label="إلى تاريخ"
        />
      </label>
      {hasRange ? (
        <button type="button" onClick={() => router.push(pathname)} className="text-sm text-[#9b5d50] underline-offset-2 hover:underline">
          إعادة التعيين
        </button>
      ) : null}
    </div>
  );
}
