import Link from "next/link";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/translations";

export default async function NotFound() {
  const t = getDictionary(await getLocale());

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f2ee] px-6 text-center text-[#201d1b]">
      <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[#7d6d69]">404</p>
      <h1 className="mt-4 brand-serif text-[4rem] leading-none text-[#1d1918]">{t.notFound.title}</h1>
      <p className="mt-4 max-w-md text-base leading-7 text-[#5f5451]">
        {t.notFound.body}
      </p>
      <Link href="/" className="mt-8 rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#332d2b]">
        {t.common.backToHome}
      </Link>
    </div>
  );
}
