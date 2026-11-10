"use client";

import { useLiveSearch } from "@/components/use-live-search";

export function SimpleSearch({ placeholder }: { placeholder: string }) {
  const { value: search, setValue: setSearch, flush } = useLiveSearch();

  return (
    <form
      className="max-w-[360px]"
      onSubmit={(event) => {
        event.preventDefault();
        flush();
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
