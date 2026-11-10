"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DELAY_MS = 350;

// Search-as-you-type for any page that keeps its query in the URL. Typing
// updates the `search` param after a short pause (no Enter needed); Enter
// applies it immediately. Other params (filters, sort) are preserved and the
// page number is reset. Uses `replace` so each keystroke doesn't add a
// history entry.
export function useLiveSearch(paramName = "search", delay = DEFAULT_DELAY_MS) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get(paramName) ?? "";

  const [value, setValue] = useState(urlValue);
  const applied = useRef(urlValue.trim());

  const apply = useCallback(
    (next: string) => {
      const term = next.trim();
      if (term === applied.current) return;
      applied.current = term;
      const params = new URLSearchParams(searchParams.toString());
      if (term) params.set(paramName, term);
      else params.delete(paramName);
      params.delete("page");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [paramName, pathname, router, searchParams],
  );

  // The URL changed from somewhere else (reset link, back button): follow it.
  useEffect(() => {
    if (urlValue.trim() !== applied.current) {
      applied.current = urlValue.trim();
      setValue(urlValue);
    }
  }, [urlValue]);

  // Debounced apply while typing.
  useEffect(() => {
    if (value.trim() === applied.current) return;
    const timer = setTimeout(() => apply(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay, apply]);

  return { value, setValue, flush: () => apply(value) };
}
