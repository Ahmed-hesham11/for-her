"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SimpleSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  return (
    <form
      className="max-w-[360px]"
      onSubmit={(event) => {
        event.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (search) params.set("search", search);
        else params.delete("search");
        params.delete("page");
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-sm outline-none placeholder:text-[#a89690] focus:border-[#c8a78f]"
      />
    </form>
  );
}
