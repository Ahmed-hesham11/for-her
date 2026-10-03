"use client";

import { useLocale } from "@/components/locale-provider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t.header.languageToggleAria}
      className={`inline-flex items-center rounded-full border border-[#e4d4ce] bg-white/60 p-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] ${className}`}
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded-full px-2.5 py-1.5 transition-all duration-300 ${
          locale === "en" ? "bg-[#1d1a19] text-white shadow-sm" : "text-[#7a6762] hover:text-[#1d1a19]"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("ar")}
        aria-pressed={locale === "ar"}
        className={`rounded-full px-2.5 py-1.5 normal-case transition-all duration-300 ${
          locale === "ar" ? "bg-[#1d1a19] text-white shadow-sm" : "text-[#7a6762] hover:text-[#1d1a19]"
        }`}
      >
        عربي
      </button>
    </div>
  );
}
