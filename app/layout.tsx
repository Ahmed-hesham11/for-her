import type { Metadata } from "next";
import { Cairo, Cormorant_Garamond, Manrope } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { CartProvider } from "@/components/cart-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { WishlistProvider } from "@/components/wishlist-provider";
import { getLocale } from "@/lib/i18n/get-locale";
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
  title: "FOR HER | More Than A Look",
  description: "Premium women's fashion, bags, jewelry, and accessories.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${manrope.variable} ${cormorant.variable} ${cairo.variable}`}>
      <body>
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
