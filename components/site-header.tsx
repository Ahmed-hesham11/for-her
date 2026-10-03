"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HeaderSearch } from "@/components/header-search";
import { BagIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from "@/components/icons";
import { LanguageToggle } from "@/components/language-toggle";
import { useAuth } from "@/components/auth-provider";
import { useCart } from "@/components/cart-provider";
import { useLocale } from "@/components/locale-provider";
import { useWishlistState } from "@/components/wishlist-provider";
import { LogoutButton } from "@/components/logout-button";
import { isAdminRole } from "@/lib/admin/roles";
import { navItems } from "@/lib/storefront-data";

const AUTH_LABEL_CLASS = "rounded-full border px-3.5 py-2 text-[0.63rem] font-semibold uppercase tracking-[0.13em] transition duration-200";
const ICON_BUTTON_CLASS = "flex h-9 w-9 items-center justify-center rounded-full border border-[#e8d7d0] bg-white/60 text-[#2f2322] transition-all duration-300 hover:scale-105 hover:border-[#c9a99d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] active:scale-95";
const NAV_LINK_CLASS = "relative py-1 transition-colors duration-300 hover:text-[#b76b5b] after:absolute after:bottom-0 after:start-0 after:h-px after:w-0 after:bg-[#a06f5c] after:transition-all after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)] hover:after:w-full focus-visible:outline-none focus-visible:after:w-full";

export function SiteHeader() {
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlistState();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, profile } = useAuth();
  const { t } = useLocale();
  const isAdmin = !isLoading && isAdminRole(profile?.role);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const navLabels: Record<string, string> = {
    Home: t.header.navHome,
    Categories: t.header.navCategories,
    Offers: t.header.navOffers,
    "Contact Us": t.header.navContact,
  };

  // One passive listener, toggling a boolean — a subtle shadow cue that the
  // page has scrolled under the sticky header, not a heavy scroll effect.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-30 border-b border-[#eadfda] bg-[#f7f1ee]/95 text-[#1f1a19] backdrop-blur transition-shadow duration-300 ${scrolled ? "shadow-[0_4px_20px_rgba(41,25,20,0.06)]" : "shadow-none"}`}>
      <div className="mx-auto max-w-[1440px] px-4 py-3 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="hidden flex-1 items-center md:flex">
            <HeaderSearch className="max-w-[280px]" />
          </div>

          <div className="flex-1 text-center md:flex-none">
            <Link href="/" className="brand-serif text-[2.4rem] leading-none tracking-[-0.04em] text-[#1b1817] md:text-[3rem]">
              FOR HER
            </Link>
            <p className="mt-1 text-[0.62rem] uppercase tracking-[0.32em] text-[#a06f5c] md:text-[0.68rem]">{t.header.tagline}</p>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
            <LanguageToggle className="hidden md:inline-flex" />

            <button
              type="button"
              onClick={() => setMobileSearchOpen((open) => !open)}
              className={`${ICON_BUTTON_CLASS} md:hidden`}
              aria-label={t.header.searchAriaButton}
              aria-expanded={mobileSearchOpen}
            >
              <SearchIcon className="h-4 w-4" />
            </button>

            <div className="hidden md:block">
              {isLoading ? (
                <span className={ICON_BUTTON_CLASS} aria-hidden="true">···</span>
              ) : isAuthenticated ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileOpen((open) => !open)}
                    className={ICON_BUTTON_CLASS}
                    aria-label={t.header.openAccountMenu}
                    aria-expanded={profileOpen}
                    aria-haspopup="menu"
                  >
                    <UserIcon className="h-4 w-4" />
                  </button>
                  {profileOpen ? (
                    <div className="absolute end-0 top-11 z-20 w-44 rounded-2xl border border-[#eadfd7] bg-[#fbf8f5] p-2 shadow-[0_12px_28px_rgba(41,25,20,0.12)]" role="menu">
                      {isAdmin ? (
                        <Link href="/admin" role="menuitem" onClick={() => setProfileOpen(false)} className="flex items-center rounded-xl px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[#322a28] transition hover:bg-[#f2e7df]">
                          {t.header.dashboard}
                        </Link>
                      ) : null}
                      <Link href="/account" role="menuitem" onClick={() => setProfileOpen(false)} className="flex items-center rounded-xl px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[#322a28] transition hover:bg-[#f2e7df]">
                        {t.header.account}
                      </Link>
                      <Link href="/orders" role="menuitem" onClick={() => setProfileOpen(false)} className="flex items-center rounded-xl px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[#322a28] transition hover:bg-[#f2e7df]">
                        {t.header.myOrders}
                      </Link>
                      <LogoutButton className="flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.12em] text-[#322a28] transition hover:bg-[#f2e7df]" label={t.header.logOut} />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/register"
                    className={`${AUTH_LABEL_CLASS} ${pathname === "/register" ? "border-[#322a28] bg-[#322a28] text-white shadow-sm" : "border-[#e4d4ce] bg-white/50 text-[#594947] hover:border-[#c9a99d] hover:bg-[#f3e7e2] hover:text-[#322a28]"}`}
                  >
                    {t.header.createAccount}
                  </Link>
                  <Link
                    href="/login"
                    className={`${AUTH_LABEL_CLASS} ${pathname === "/login" ? "border-[#322a28] bg-[#322a28] text-white shadow-sm" : "border-[#e4d4ce] bg-white/50 text-[#594947] hover:border-[#c9a99d] hover:bg-[#f3e7e2] hover:text-[#322a28]"}`}
                  >
                    {t.header.signIn}
                  </Link>
                </div>
              )}
            </div>

            <Link href="/wishlist" className={`relative ${ICON_BUTTON_CLASS}`} aria-label={t.header.wishlistAria}>
              <HeartIcon className="h-4 w-4" />
              {wishlistCount > 0 ? (
                <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1f1b1a] px-1 text-[0.58rem] font-semibold text-white">
                  {wishlistCount}
                </span>
              ) : null}
            </Link>

            <Link href="/cart" className={`relative ${ICON_BUTTON_CLASS}`} aria-label={t.header.cartAria}>
              <BagIcon className="h-4 w-4" />
              {cartCount > 0 ? (
                <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1f1b1a] px-1 text-[0.58rem] font-semibold text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className={`${ICON_BUTTON_CLASS} md:hidden`}
              aria-label={t.header.menuAria}
            >
              <MenuIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {mobileSearchOpen ? (
          <div className="mt-3 md:hidden">
            <HeaderSearch />
          </div>
        ) : null}

        <nav className="mt-4 hidden items-center justify-center gap-8 border-t border-[#ebddd7] pt-4 text-[0.74rem] font-medium uppercase tracking-[0.16em] text-[#201d1a] md:flex">
          {navItems.map((item) => {
            const href = item.toLowerCase().replace(/\s+/g, "-");
            return (
              <Link key={item} href={href === "home" ? "/" : `/${href}`} className={NAV_LINK_CLASS}>
                {navLabels[item] ?? item}
              </Link>
            );
          })}
        </nav>

        {mobileOpen ? (
          <nav className="mt-4 grid gap-2 border-t border-[#ebddd7] pt-4 text-[0.74rem] font-medium uppercase tracking-[0.16em] text-[#201d1a] md:hidden">
            <LanguageToggle className="mx-auto mb-1" />
            {navItems.map((item) => {
              const href = item.toLowerCase().replace(/\s+/g, "-");
              return (
                <Link key={item} href={href === "home" ? "/" : `/${href}`} className="rounded-full border border-[#ebddd7] bg-white/60 px-3 py-2 text-center transition hover:text-[#b76b5b]" onClick={() => setMobileOpen(false)}>
                  {navLabels[item] ?? item}
                </Link>
              );
            })}
            {isLoading ? null : <div className="my-1 h-px bg-[#ebddd7]" aria-hidden="true" />}
            {!isLoading && isAuthenticated ? (
              <>
                {isAdmin ? (
                  <Link href="/admin" className="rounded-full border border-[#ebddd7] bg-white/60 px-3 py-2 text-center transition hover:text-[#b76b5b]" onClick={() => setMobileOpen(false)}>
                    {t.header.dashboard}
                  </Link>
                ) : null}
                <Link href="/account" className="rounded-full border border-[#ebddd7] bg-white/60 px-3 py-2 text-center transition hover:text-[#b76b5b]" onClick={() => setMobileOpen(false)}>
                  {t.header.account}
                </Link>
                <Link href="/orders" className="rounded-full border border-[#ebddd7] bg-white/60 px-3 py-2 text-center transition hover:text-[#b76b5b]" onClick={() => setMobileOpen(false)}>
                  {t.header.myOrders}
                </Link>
                <LogoutButton className="rounded-full border border-[#ebddd7] bg-white/60 px-3 py-2 text-center transition hover:text-[#b76b5b]" label={t.header.logOut} />
              </>
            ) : !isLoading ? (
              <>
                <Link href="/login" className="rounded-full border border-[#ebddd7] bg-white/60 px-3 py-2 text-center transition hover:text-[#b76b5b]" onClick={() => setMobileOpen(false)}>
                  {t.header.signIn}
                </Link>
                <Link href="/register" className="rounded-full border border-[#ebddd7] bg-white/60 px-3 py-2 text-center transition hover:text-[#b76b5b]" onClick={() => setMobileOpen(false)}>
                  {t.header.createAccount}
                </Link>
              </>
            ) : null}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
