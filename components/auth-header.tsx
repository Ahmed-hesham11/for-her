"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";

export function AuthHeader() {
  const { t } = useLocale();

  return (
    <header className="border-b border-[#e8ddd7] bg-[#faf6f3]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" className="brand-serif text-[1.7rem] leading-none tracking-[-0.03em] text-[#1b1817] md:text-[2rem]">
          FOR HER
        </Link>
        <div className="flex items-center gap-2.5">
          <LanguageToggle />
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full border border-[#e4d4ce] bg-white/70 px-3.5 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-[#4a4442] transition hover:border-[#cba99c] hover:bg-[#f5e8e2] hover:text-[#1d1a19]"
          >
            <span className="text-base leading-none transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" aria-hidden="true">←</span>
            {t.auth.backToShop}
          </Link>
        </div>
      </div>
    </header>
  );
}
