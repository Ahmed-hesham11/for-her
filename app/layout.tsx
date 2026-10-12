import type { Metadata } from "next";
import { Cairo, Cormorant_Garamond, Manrope } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { CartProvider } from "@/components/cart-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { WishlistProvider } from "@/components/wishlist-provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Cormorant/Manrope have no Arabic glyphs, so RTL falls back to this instead
// of an unstyled system serif — see the [dir="rtl"] override in globals.css.
const cairo = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: `${SITE_NAME} | ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} | ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
};

// Tells Google the site's name and canonical URL so a search for the brand
// name shows "FOR HER" with the right link.
const siteJsonLd = JSON.stringify([
  { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, alternateName: ["For Her", "فور هير"], url: getSiteUrl() },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: getSiteUrl(),
    logo: `${getSiteUrl()}/icon`,
    sameAs: SOCIAL_LINKS.filter((social) => social.label !== "WhatsApp").map((social) => social.href.split("?")[0]),
  },
]);

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${manrope.variable} ${cormorant.variable} ${cairo.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteJsonLd }} />
        <LocaleProvider initialLocale={locale}>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>{children}</WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
