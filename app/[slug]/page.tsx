import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter, SOCIAL_LINKS } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProductCard } from "@/components/product-card";
import { CategorySidebar } from "@/components/category-sidebar";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getCategories, getProducts } from "@/lib/storefront-data-server";
import { productMatchesNames, resolveCategoryProductNames } from "@/lib/storefront-data";

const routeTypes: Record<string, "category" | "collection" | "info"> = {
  jewelry: "category",
  accessories: "category",
  bags: "category",
  "new-arrivals": "collection",
  "best-sellers": "collection",
  offers: "collection",
  sale: "collection",
  "contact-us": "info",
};

export default async function DynamicCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = getDictionary(await getLocale());
  const { slug } = await params;
  const normalized = slug.toLowerCase();
  const routeType = routeTypes[normalized];
  const route = t.routeCatalog[normalized];

  if (!routeType || !route) {
    notFound();
  }

  if (routeType === "info") {
    const findSocial = (label: string) => SOCIAL_LINKS.find((social) => social.label === label)!;
    const whatsapp = findSocial("WhatsApp");
    const instagram = findSocial("Instagram");
    const facebook = findSocial("Facebook");
    const tiktok = findSocial("TikTok");

    const contactCards = [
      { ...whatsapp, label: t.contactPage.whatsappLabel, value: "+20 103 510 9074" },
      { ...instagram, label: t.contactPage.instagramLabel, value: "@forher_272" },
      { ...facebook, label: t.contactPage.facebookLabel, value: "For Her" },
      { ...tiktok, label: t.contactPage.tiktokLabel, value: "@forher_272" },
    ];

    return (
      <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
        <SiteHeader />
        <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
          <section className="overflow-hidden rounded-[30px] border border-[#eaded6] bg-[#f5f0ee] p-6 shadow-[0_18px_38px_rgba(35,22,18,0.04)] md:p-10">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-[#a06f5c]">{t.contactPage.brand}</p>
              <h1 className="mt-4 brand-serif text-[2.6rem] leading-none text-[#1d1918] md:text-[4rem]">{route.title}</h1>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#5f524f] md:text-lg">{route.description}</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href={whatsapp.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-[#fffaf7] transition hover:bg-[#332d2b]">
                  <whatsapp.Icon className="h-4 w-4" /> {t.contactPage.messageUs}
                </a>
                <a href={instagram.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 rounded-full border border-[#d9c4b8] bg-white/60 px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-[#3a312e] transition hover:bg-white">
                  <instagram.Icon className="h-4 w-4" /> {t.contactPage.followUs}
                </a>
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="grid gap-5 sm:grid-cols-2">
              {contactCards.map(({ Icon, label, value, href }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" className="rounded-[22px] border border-[#eadfd8] bg-[#fffaf8] p-6 shadow-[0_14px_30px_rgba(45,29,23,0.04)] transition hover:border-[#c9a291]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e1d8] text-[#8f675d]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="mt-4 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[#826d68]">{label}</h2>
                  <p className="mt-2 text-base leading-6 text-[#2b2625]">{value}</p>
                </a>
              ))}
            </div>

            <div className="rounded-[22px] border border-[#eadfd8] bg-[#fffaf8] p-6 shadow-[0_14px_30px_rgba(45,29,23,0.04)] md:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#a06f5c]">{t.contactPage.needHelp}</p>
              <h2 className="mt-4 brand-serif text-[2.1rem] leading-none text-[#1d1918]">{t.contactPage.sendMessage}</h2>
              <p className="mt-4 text-base leading-7 text-[#564b49]">{t.contactPage.sendMessageDesc}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={whatsapp.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-[#fffaf7] transition hover:bg-[#332d2b]">
                  <whatsapp.Icon className="h-4 w-4" /> {t.contactPage.startChat}
                </a>
                <a href={instagram.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 rounded-full border border-[#d9c4b8] bg-transparent px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-[#3a312e] transition hover:bg-white">
                  <instagram.Icon className="h-4 w-4" /> {t.contactPage.viewProfile}
                </a>
              </div>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const categoryMatch = categories.find((item) => item.slug === normalized);
  const { category: categorySlug, subcategory: subcategorySlug } = await searchParams;

  const baseCollectionProducts = (() => {
    if (routeType === "category" && categoryMatch) {
      return products.filter((product) => product.category.toLowerCase() === categoryMatch.name.toLowerCase());
    }

    if (normalized === "new-arrivals") {
      return [...products].slice(0, 4);
    }

    if (normalized === "best-sellers") {
      // No real sales-ranking data is wired up yet (would require aggregating
      // order_items) — show the active catalog rather than a fabricated order.
      return [...products].slice(0, 4);
    }

    if (normalized === "sale" || normalized === "offers") {
      // No discount/compare-at-price column exists on products yet, so there
      // is no real "on sale" set — the empty state below covers this route.
      return products.filter((product) => product.originalPrice !== null && product.originalPrice > product.price);
    }

    return products;
  })();

  const matchNames = resolveCategoryProductNames(categories, categorySlug ?? "", subcategorySlug ?? "");
  const collectionProducts = matchNames
    ? baseCollectionProducts.filter((product) => productMatchesNames(product, matchNames))
    : baseCollectionProducts;

  return (
    <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <div className="mb-8">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#836f67]">{t.collectionPage.eyebrow}</p>
          <h1 className="brand-serif text-[3rem] leading-none text-[#1c1918]">{route.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#5f524f]">{route.description}</p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          <Suspense fallback={<div className="hidden w-[220px] shrink-0 lg:block" aria-hidden="true" />}>
            <CategorySidebar categories={categories} />
          </Suspense>

          <div className="min-w-0 flex-1">
            {collectionProducts.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {collectionProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="rounded-[20px] border border-[#eadfd8] bg-[#fff8f5] p-8 text-center text-[#5f524f]">
                {t.collectionPage.empty}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
