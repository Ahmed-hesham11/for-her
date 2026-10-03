"use client";

import { AuthHeader } from "@/components/auth-header";
import { useLocale } from "@/components/locale-provider";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f8f2ee] text-[#201d1b]">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-28 h-80 w-80 rounded-full bg-[#f0dfd7]/45 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#efe3d7]/50 blur-3xl" />
      <AuthHeader />

      <main className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-1 items-center px-5 py-10 md:px-8 md:py-16">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-[#e8dcd5] bg-[#fbf9f7]/95 shadow-[0_28px_70px_rgba(58,35,29,0.10)] md:grid-cols-2">
          {/* Editorial panel — no project image exists, so this is a typographic
              brand panel rather than a stock photo. */}
          <div className="relative hidden min-h-[490px] flex-col justify-between overflow-hidden bg-[#f2e5de] p-12 md:flex">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.38]">
              <div className="absolute left-1/2 top-1/2 h-[470px] w-[470px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d9b998]" />
              <div className="absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d9b998]" />
            </div>
            <div aria-hidden="true" className="absolute -bottom-16 -left-16 h-44 w-44 rounded-full border border-[#d9b998]/50" />

            <p className="relative text-[0.68rem] uppercase tracking-[0.32em] text-[#8a7268]">{t.auth.panelBrand}</p>

            <div className="relative">
              <p className="text-[0.66rem] uppercase tracking-[0.34em] text-[#a9836f]">{t.auth.panelEyebrow}</p>
              <p className="brand-serif-italic mt-5 max-w-sm text-[2.8rem] leading-[1.12] text-[#2a1f1d]">
                {t.auth.panelHeadlineLine1}
                <br />
                {t.auth.panelHeadlineLine2}
              </p>
            </div>

            <div className="relative flex items-center gap-3 text-[#a9836f]">
              <span className="h-px w-10 bg-[#c9a98d]" />
              <span className="text-[0.64rem] uppercase tracking-[0.26em]">{t.auth.panelFooter}</span>
            </div>
          </div>

          {/* Form panel */}
          <div className="flex flex-col justify-center px-6 py-11 sm:px-10 md:px-14">
            <div className="mx-auto w-full max-w-[420px]">
              <p className="flex items-center gap-2 text-[0.67rem] uppercase tracking-[0.23em] text-[#8a7067]"><span className="h-px w-6 bg-[#c7a594]" />{eyebrow}</p>
              <h1 className="mt-3 brand-serif text-[2.7rem] leading-none text-[#1d1918]">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-[#625b58]">{description}</p>
              <div className="mt-7">{children}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
