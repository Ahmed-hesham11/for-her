import { CategoryEditorialGrid } from "@/components/category-editorial-grid";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getCategories } from "@/lib/storefront-data-server";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const t = getDictionary(await getLocale());
  const allCategories = await getCategories();
  const topCategories = allCategories.filter((category) => category.parentId === null);

  return (
    <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
        <div className="mb-12 text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#a06f5c]">{t.categoriesPage.eyebrow}</p>
          <h1 className="mt-3 brand-serif text-[2.6rem] leading-none tracking-[-0.03em] text-[#1d1918] md:text-[3rem]">{t.categoriesPage.title}</h1>
        </div>

        <CategoryEditorialGrid categories={topCategories} allCategories={allCategories} />
      </main>
      <SiteFooter />
    </div>
  );
}
