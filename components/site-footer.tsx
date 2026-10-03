"use client";

import Link from "next/link";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";

export const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/forher_272?stkn=MWQwcW10ZWc5cWlhMA%3D%3D&utm_source=qr", Icon: InstagramIcon },
  { label: "Facebook", href: "https://www.facebook.com/share/19Sze6D5LZ/?mibextid=wwXIfr", Icon: FacebookIcon },
  { label: "TikTok", href: "https://www.tiktok.com/@forher_272?_r=1&_t=ZS-99ozpDmcKkm", Icon: TikTokIcon },
  { label: "WhatsApp", href: "https://wa.me/201035109074", Icon: WhatsAppIcon },
];

export function SiteFooter() {
  const { t } = useLocale();

  const shopLinks = [
    { label: t.footer.shopHome, href: "/" },
    { label: t.footer.shopShop, href: "/products" },
    { label: t.footer.shopCategories, href: "/categories" },
    { label: t.footer.shopNewArrivals, href: "/new-arrivals" },
  ];

  // No dedicated pages exist yet for these topics — routed to Contact Us, the
  // one real, relevant destination.
  const helpLinks = [
    { label: t.footer.helpShipping, href: "/contact-us" },
    { label: t.footer.helpReturns, href: "/contact-us" },
    { label: t.footer.helpFaq, href: "/contact-us" },
    { label: t.footer.helpContact, href: "/contact-us" },
  ];

  return (
    <footer className="mt-12 border-t border-[#eadcd4] bg-[#f8f1ee] text-[#2c2321]">
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-3">
            <span className="brand-serif text-[2rem] leading-none">FOR HER</span>
            <p className="text-[0.64rem] uppercase tracking-[0.26em] text-[#a06f5c]">{t.footer.tagline}</p>
            <p className="text-sm text-[#6b5e5a]">{t.footer.description}</p>
            <div className="flex gap-2 pt-1 text-[#3a2d2a]">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e9d9d0] bg-white/60 transition hover:border-[#c9a291] hover:text-[#b66e64]"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-[#584f4d]">{t.footer.shopHeading}</h4>
            <ul className="space-y-2 text-sm text-[#534845]">
              {shopLinks.map((item) => (
                <li key={item.label}><Link href={item.href} className="transition hover:text-[#b66e64]">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-[#584f4d]">{t.footer.helpHeading}</h4>
            <ul className="space-y-2 text-sm text-[#534845]">
              {helpLinks.map((item) => (
                <li key={item.label}><Link href={item.href} className="transition hover:text-[#b66e64]">{item.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-[#e8dad3] pt-4 text-xs text-[#6d605d] sm:flex-row sm:items-center sm:justify-between">
          <p>{t.footer.rights}</p>
          <div className="flex items-center gap-3">
            <Link href="/" className="hover:text-[#b66e64]">{t.footer.terms}</Link>
            <span aria-hidden="true" className="text-[#cbb9b1]">|</span>
            <Link href="/" className="hover:text-[#b66e64]">{t.footer.privacy}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
