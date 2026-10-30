"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { trackPageView } from "@/lib/meta-pixel";

// Fires PageView on first load and on every client-side navigation. The base
// snippet (MetaPixelScript) deliberately does NOT track PageView itself, so
// the initial load isn't counted twice.
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    // Short delay so a redirect (e.g. /categories/x/y -> /products?...) only
    // reports the final route instead of two PageViews back to back.
    const timer = setTimeout(trackPageView, 300);
    return () => clearTimeout(timer);
  }, [pathname, search]);

  return null;
}

export function MetaPixelTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}
