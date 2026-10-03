import Link from "next/link";
import Image from "next/image";
import { ArrowIcon } from "@/components/icons";
import { CategoryEditorialGrid } from "@/components/category-editorial-grid";
import { ProductCard } from "@/components/product-card";
import { Reveal, StaggerReveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getBestSellers, getCategories } from "@/lib/storefront-data-server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = getDictionary(await getLocale());
  const startedAt = performance.now();
  const [allCategories, bestSellers] = await Promise.all([getCategories(), getBestSellers(5)]);
  // "Clothes" shows as one featured tile here — its subcategories are
  // browsed on /categories/clothes, not listed individually on the homepage.
  const topCategories = allCategories.filter((category) => category.parentId === null);
  if (process.env.NODE_ENV !== "production") console.debug(`[perf] route render /: ${(performance.now() - startedAt).toFixed(0)}ms`);

  return (
    <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
      <SiteHeader />

      <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-4 md:px-8 md:pt-6">
        {/* Hero — the banner already carries its own branding/copy, so no
            headline text is duplicated here in HTML. The photo is dense
            edge-to-edge, so the CTA buttons sit below it rather than
            overlaid on top, to keep the artwork fully clear. */}
        <section>
          <div className="animate-fade-in relative isolate overflow-hidden rounded-[30px] shadow-[0_24px_60px_rgba(64,39,31,0.12)]">
            <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[3/2] md:aspect-[2000/750]">
              <Image
                src="/hero-banner.webp"
                alt="FOR HER — More than a look. New Arrivals: your style, always here. Fashion, accessories, and more."
                fill
                priority
                sizes="100vw"
                className="animate-hero-zoom object-cover object-[30%_center] md:object-center"
              />
            </div>
          </div>

          <div className="animate-fade-up mt-6 flex flex-wrap items-center justify-center gap-3 [animation-delay:150ms]">
            <Link href="/products" className="group inline-flex items-center gap-3 rounded-full bg-[#241d1b] px-6 py-3.5 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-white shadow-[0_10px_24px_rgba(36,29,27,0.16)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#3a2d29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] focus-visible:ring-offset-2 active:translate-y-0">
              {t.home.shopNow} <ArrowIcon className="h-4 w-4 rtl:rotate-180 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Link>
            <Link href="/categories" className="inline-flex items-center rounded-full border border-[#241d1b]/60 px-6 py-3.5 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-[#241d1b] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] focus-visible:ring-offset-2 active:translate-y-0">
              {t.home.exploreCategories}
            </Link>
          </div>
        </section>

        <section className="mt-20">
          <Reveal className="flex flex-col items-center gap-2 text-center">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-[#a06f5c]">{t.home.findSignature}</p>
            <h2 className="brand-serif text-[2.4rem] leading-none tracking-[-0.04em] text-[#1d1715]">{t.home.shopByCategory}</h2>
            <Link href="/categories" className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#5e4b45] transition-colors duration-300 hover:text-[#a06f5c]">{t.home.viewAllCategories}</Link>
          </Reveal>
          <div className="mb-8 mt-6 border-b border-[#e5d9d3]" aria-hidden="true" />
          <CategoryEditorialGrid categories={topCategories} allCategories={allCategories} />
        </section>

        <section className="mt-24">
          <Reveal className="flex flex-col items-center gap-2 text-center">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-[#a06f5c]">{t.home.curatedFavorites}</p>
            <h2 className="brand-serif text-[2.5rem] leading-none tracking-[-0.04em] text-[#1d1715]">{t.home.bestSellers}</h2>
            <Link href="/products" className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#5e4b45] transition-colors duration-300 hover:text-[#a06f5c]">{t.home.shopAllPieces}</Link>
          </Reveal>
          <div className="mb-8 mt-6 border-b border-[#e5d9d3]" aria-hidden="true" />
          {bestSellers.length > 0 ? (
            <StaggerReveal className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
              {bestSellers.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </StaggerReveal>
          ) : (
            <div className="rounded-[20px] border border-[#eadfd8] bg-[#fff8f5] p-8 text-center text-[#5f524f]">
              {t.home.noBestSellers}
            </div>
          )}
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}
