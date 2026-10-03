import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryCard } from "@/components/category-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getCategories } from "@/lib/storefront-data-server";

export const dynamic = "force-dynamic";

export default async function CategoryHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = getDictionary(await getLocale());
  const { slug } = await params;
  const normalized = slug.toLowerCase();
  const categories = await getCategories();

  const category = categories.find((item) => item.slug === normalized);
  if (!category) {
    notFound();
  }

  const subcategories = categories.filter((item) => item.parentId === category.id);

  // Only Clothes (or any future category with children) gets this hub page —
  // a plain category has no subcategories, so send it to the normal product
  // listing instead, keeping the flat category system untouched.
  if (subcategories.length === 0) {
    redirect(`/products?category=${category.slug}`);
  }

  return (
    <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <Breadcrumbs items={[{ label: t.categoryHub.breadcrumbHome, href: "/" }, { label: t.categoryHub.breadcrumbCategories, href: "/categories" }, { label: category.name }]} />

        <div className="mb-12 text-center">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#a06f5c]">{category.name}</p>
          <h1 className="mt-3 brand-serif text-[2.8rem] leading-none text-[#1d1918] md:text-[3.4rem]">{t.categoryHub.discoverStyle}</h1>
        </div>

        <h2 className="mb-6 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#5e4b45]">{t.categoryHub.clothingCategories}</h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4">
          {subcategories.map((sub) => (
            <CategoryCard key={sub.id} category={sub} href={`/categories/${category.slug}/${sub.slug}`} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
