"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, LOCALE_COOKIE, type Dictionary, type Locale } from "@/lib/i18n/translations";

type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Dictionary;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

export function LocaleProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    applyDocumentLocale(next);
    // 1 year, readable by the server on the next full page load so the
    // initial SSR markup already has the right lang/dir — no flash.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    // Server Components (the hero copy, "Best sellers" heading, etc.) only
    // read the cookie on an actual server round-trip — without this they'd
    // stay in the old language until a manual hard reload.
    router.refresh();
  }, [router]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    t: getDictionary(locale),
    setLocale,
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
