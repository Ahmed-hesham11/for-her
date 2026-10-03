import Link from "next/link";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CategorySidebar } from "@/components/category-sidebar";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getCategories, getProducts } from "@/lib/storefront-data-server";
import { ProductCard } from "@/components/product-card";
import { ProductFiltersBar, type SortValue } from "@/components/product-filters-bar";
import { productMatchesNames, resolveCategoryProductNames, type Product } from "@/lib/storefront-data";

const PAGE_SIZE = 12;

function sortProducts(products: Product[], sort: SortValue): Product[] {
  switch (sort) {
    case "price_asc":
      return [...products].sort((a, b) => a.price - b.price);
    case "price_desc":
      return [...products].sort((a, b) => b.price - a.price);
    case "name_asc":
      return [...products].sort((a, b) => a.name.localeCompare(b.name));
    case "newest":
    default:
      // getProducts() already returns newest-active-product-first.
      return products;
  }
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = getDictionary(await getLocale());
  const params = await searchParams;
  const startedAt = performance.now();
  const [categories, allProducts] = await Promise.all([getCategories(), getProducts()]);
  if (process.env.NODE_ENV !== "production") console.debug(`[perf] route render /products: ${(performance.now() - startedAt).toFixed(0)}ms`);

  const searchTerm = params.search?.trim().toLowerCase() ?? "";
  const categorySlug = params.category ?? "";
  const subcategorySlug = params.subcategory ?? "";
  const sort: SortValue = ["price_asc", "price_desc", "name_asc", "newest"].includes(params.sort ?? "")
    ? (params.sort as SortValue)
    : "newest";
  const page = Math.max(1, Number(params.page) || 1);

  const activeCategory = categorySlug ? categories.find((category) => category.slug === categorySlug) : undefined;
  const activeSubcategory = subcategorySlug ? categories.find((category) => category.slug === subcategorySlug) : undefined;
  const matchNames = resolveCategoryProductNames(categories, categorySlug, subcategorySlug);

  let filtered = allProducts;
  if (matchNames) {
    filtered = filtered.filter((product) => productMatchesNames(product, matchNames));
  }
  if (searchTerm) {
    filtered = filtered.filter((product) =>
      product.name.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm) ||
      product.sku.toLowerCase().includes(searchTerm),
    );
  }
  const sorted = sortProducts(filtered, sort);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageProducts = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function pageHref(targetPage: number) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.category) query.set("category", params.category);
    if (params.subcategory) query.set("subcategory", params.subcategory);
    if (params.sort) query.set("sort", params.sort);
    if (targetPage > 1) query.set("page", String(targetPage));
    const queryString = query.toString();
    return queryString ? `/products?${queryString}` : "/products";
  }

  return (
    <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-10 md:px-8 md:pt-14">
        <header className="max-w-2xl">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#a06f5c]">{t.productsPage.shopAll}</p>
          <h1 className="mt-3 brand-serif text-[3.4rem] leading-[0.95] tracking-[-0.04em] text-[#1c1918] md:text-[4.5rem]">{t.productsPage.title}</h1>
          <p className="mt-5 max-w-lg text-[0.98rem] leading-7 text-[#756763]">{t.productsPage.subtitle}</p>
        </header>

        <div className="mt-10 flex flex-col gap-8 lg:mt-12 lg:flex-row lg:items-start lg:gap-10">
          <Suspense fallback={<div className="hidden w-[220px] shrink-0 lg:block" aria-hidden="true" />}>
            <CategorySidebar categories={categories} />
          </Suspense>

          <div className="min-w-0 flex-1">
            <div className="border-b border-[#e5d9d3] pb-4">
              <Suspense fallback={<div className="h-12" aria-hidden="true" />}>
                <ProductFiltersBar />
              </Suspense>
            </div>

            {sorted.length === 0 ? (
              <div className="mt-10 border border-[#e6d9d2] bg-[#fffdfb] px-6 py-16 text-center md:px-10">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#a06f5c]">{t.productsPage.noProductsEyebrow}</p>
                <h2 className="mt-3 brand-serif text-[2.4rem] leading-none text-[#29201d]">{t.productsPage.noProductsTitle}</h2>
                <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#756763]">{t.productsPage.noProductsBody}</p>
                <Link href="/products" className="mt-7 inline-flex rounded-full bg-[#211c1a] px-6 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.17em] text-white transition hover:bg-[#3a2f2a]">
                  {t.productsPage.resetFilters}
                </Link>
              </div>
            ) : (
              <>
                <div className="mt-8 flex items-center justify-between text-[0.68rem] uppercase tracking-[0.16em] text-[#887873]">
                  <span>{sorted.length} {sorted.length === 1 ? t.productsPage.piece : t.productsPage.pieces}</span>
                  {activeSubcategory ? (
                    <span className="text-[#a06f5c]">{activeSubcategory.name}</span>
                  ) : activeCategory ? (
                    <span className="text-[#a06f5c]">{activeCategory.name}</span>
                  ) : null}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 md:gap-y-10 xl:grid-cols-4">
                  {pageProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {pageCount > 1 ? (
                  <div className="mt-14 flex items-center justify-center gap-4">
                    {safePage > 1 ? (
                      <Link href={pageHref(safePage - 1)} className="rounded-full border border-[#e8d9d2] bg-white/70 px-5 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#3a312e] transition hover:bg-white">
                        {t.productsPage.previous}
                      </Link>
                    ) : null}
                    <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[#786d6a]">
                      {t.productsPage.pageOf(safePage, pageCount)}
                    </span>
                    {safePage < pageCount ? (
                      <Link href={pageHref(safePage + 1)} className="rounded-full border border-[#e8d9d2] bg-white/70 px-5 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#3a312e] transition hover:bg-white">
                        {t.productsPage.next}
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
