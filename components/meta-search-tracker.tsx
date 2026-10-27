"use client";

import { useEffect } from "react";
import { trackSearch } from "@/lib/meta-pixel";

// Fires Search once per distinct search term shown on the products page.
export function MetaSearchTracker({ term }: { term: string }) {
  useEffect(() => {
    if (term) trackSearch(term);
  }, [term]);

  return null;
}
