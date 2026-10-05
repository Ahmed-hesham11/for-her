"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SELECT_CLASS = "rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-sm text-[#2f2725] outline-none focus:border-[#c8a78f]";

export function InsightsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasRange = Boolean(searchParams.get("from") || searchParams.get("to"));

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="date"
        defaultValue={searchParams.get("from") ?? ""}
        onChange={(event) => updateParam("from", event.target.value)}
        className={SELECT_CLASS}
        aria-label="من تاريخ"
      />
      <input
        type="date"
        defaultValue={searchParams.get("to") ?? ""}
        onChange={(event) => updateParam("to", event.target.value)}
        className={SELECT_CLASS}
        aria-label="إلى تاريخ"
      />
      {hasRange ? (
        <button type="button" onClick={() => router.push(pathname)} className="text-sm text-[#9b5d50] underline-offset-2 hover:underline">
          إعادة التعيين
        </button>
      ) : null}
    </div>
  );
}
