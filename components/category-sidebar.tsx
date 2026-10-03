"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDownIcon, CloseIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import type { Category } from "@/lib/storefront-data";

function buildHref(pathname: string, searchParams: URLSearchParams, updates: Record<string, string | null>) {
  const params = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function Dot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`h-3.5 w-3.5 shrink-0 rounded-[4px] border transition-colors ${active ? "border-[#a06f5c] bg-[#a06f5c]" : "border-[#d6c6bd]"}`}
    />
  );
}

export function CategorySidebar({ categories }: { categories: Category[] }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategorySlug = searchParams.get("category") ?? "";
  const activeSubcategorySlug = searchParams.get("subcategory") ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeCategorySlug ? [activeCategorySlug] : []));

  // Keep the active category's subcategories visible when navigation changes
  // it (e.g. a fresh page load with ?category=... already set).
  useEffect(() => {
    if (!activeCategorySlug) return;
    setExpanded((current) => (current.has(activeCategorySlug) ? current : new Set(current).add(activeCategorySlug)));
  }, [activeCategorySlug]);

  const topCategories = categories.filter((category) => category.parentId === null);
  const childrenOf = (id: string) => categories.filter((category) => category.parentId === id);

  function toggleExpanded(slug: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const listContent = (
    <div>
      <h3 className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#584f4d]">{t.sidebar.categoriesHeading}</h3>
      <ul className="space-y-1">
        <li>
          <Link
            href={buildHref(pathname, searchParams, { category: null, subcategory: null })}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-white/70 ${!activeCategorySlug ? "font-medium text-[#a06f5c]" : "text-[#4a4442]"}`}
          >
            <Dot active={!activeCategorySlug} />
            {t.sidebar.allProducts}
          </Link>
        </li>
        {topCategories.map((category) => {
          const children = childrenOf(category.id);
          const hasChildren = children.length > 0;
          const isActive = activeCategorySlug === category.slug && !activeSubcategorySlug;
          const isExpanded = expanded.has(category.slug);

          return (
            <li key={category.id}>
              <div className="flex items-center">
                <Link
                  href={buildHref(pathname, searchParams, { category: category.slug, subcategory: null })}
                  onClick={() => setMobileOpen(false)}
                  className={`flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-white/70 ${isActive ? "font-medium text-[#a06f5c]" : "text-[#4a4442]"}`}
                >
                  <Dot active={isActive} />
                  {category.name}
                </Link>
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(category.slug)}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? t.sidebar.collapse : t.sidebar.expand} ${category.name}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center text-[#8a7972] transition hover:text-[#a06f5c]"
                  >
                    <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                ) : null}
              </div>

              {hasChildren && isExpanded ? (
                <ul className="ms-[7px] mt-1 space-y-1 border-s border-[#e5d7d1] ps-3">
                  {children.map((child) => {
                    const childActive = activeCategorySlug === category.slug && activeSubcategorySlug === child.slug;
                    return (
                      <li key={child.id}>
                        <Link
                          href={buildHref(pathname, searchParams, { category: category.slug, subcategory: child.slug })}
                          onClick={() => setMobileOpen(false)}
                          className={`block rounded-lg px-2.5 py-1.5 text-[0.85rem] transition hover:bg-white/70 ${childActive ? "font-medium text-[#a06f5c]" : "text-[#665955]"}`}
                        >
                          {child.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );

  const activeCategory = categories.find((category) => category.slug === activeCategorySlug);
  const activeSubcategory = categories.find((category) => category.slug === activeSubcategorySlug && category.parentId === activeCategory?.id);
  const mobileLabel = activeSubcategory?.name ?? activeCategory?.name ?? t.sidebar.allProducts;

  return (
    <>
      <aside className="hidden shrink-0 lg:block lg:w-[220px]">
        <nav aria-label={t.sidebar.productCategoriesAria} className="sticky top-24">{listContent}</nav>
      </aside>

      <div className="mb-6 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[#e5d7d1] bg-white/70 px-4 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#3a312e] transition hover:bg-white"
        >
          {t.sidebar.filters}
          <span className="text-[#a06f5c]">· {mobileLabel}</span>
        </button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label={t.sidebar.closeFilters} onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-y-0 start-0 w-[82%] max-w-[320px] overflow-y-auto bg-[#f8f2ee] p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#584f4d]">{t.sidebar.filters}</span>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label={t.sidebar.closeFilters} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5d7d1]">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <nav aria-label={t.sidebar.productCategoriesAria}>{listContent}</nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
