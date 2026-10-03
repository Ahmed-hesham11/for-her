"use client";

import { getDictionary, isLocale, LOCALE_COOKIE } from "@/lib/i18n/translations";

// This replaces the whole root layout on a crash, so LocaleProvider's
// context isn't mounted here — read the cookie directly instead.
function readLocale() {
  if (typeof document === "undefined") return "en" as const;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return isLocale(value) ? value : "en";
}

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = readLocale();
  const t = getDictionary(locale);

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body className="flex min-h-screen items-center justify-center bg-[#f8f2ee] px-6 text-center text-[#201d1b]">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[#7d6d69]">{t.globalError.eyebrow}</p>
          <h1 className="mt-4 brand-serif text-[4rem] leading-none text-[#1d1918]">{t.globalError.title}</h1>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-8 rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#332d2b]"
          >
            {t.globalError.tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}
