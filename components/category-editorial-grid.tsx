"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { StaggerReveal } from "@/components/reveal";
import type { Category } from "@/lib/storefront-data";

// Editorial grid: any top-level category with subcategories (currently just
// Clothes) renders as a large 2x2 featured tile; every other category —
// unchanged routes/behavior — fills in around it as a standard cell.
// grid-flow-dense packs those smaller cells into the gaps automatically, so
// this adapts to however many categories actually exist.
export function CategoryEditorialGrid({ categories, allCategories }: { categories: Category[]; allCategories: Category[] }) {
  const { t } = useLocale();
  const hasChildren = (categoryId: string) => allCategories.some((item) => item.parentId === categoryId);

  return (
    <StaggerReveal className="grid grid-flow-dense grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 auto-rows-[190px] sm:auto-rows-[220px] lg:auto-rows-[240px]">
      {categories.map((category) => {
        const isFeatured = hasChildren(category.id);

        return (
          <Link
            key={category.id}
            href={isFeatured ? `/categories/${category.slug}` : `/products?category=${category.slug}`}
            className={`group relative block overflow-hidden rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a06f5c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f2ee] ${isFeatured ? "col-span-2 row-span-2" : ""}`}
          >
            <Image
              src={category.image}
              alt={category.name}
              fill
              sizes={isFeatured ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw"}
              className="object-cover transition-transform duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#1b1512]/70 via-[#1b1512]/10 to-transparent transition-opacity duration-500 group-hover:from-[#1b1512]/80" />
            <div className={`absolute inset-x-0 bottom-0 p-4 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 ${isFeatured ? "sm:p-7" : "sm:p-5"}`}>
              {isFeatured ? (
                <span className="mb-2 inline-block rounded-full bg-white/15 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">{t.categoryGrid.shopByStyle}</span>
              ) : null}
              <h2 className={`brand-serif leading-none text-white ${isFeatured ? "text-[2.4rem] sm:text-[3rem]" : "text-[1.4rem] sm:text-[1.7rem]"}`}>
                {category.name}
              </h2>
              <span className={`mt-2 inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.14em] text-white/85 transition-colors duration-300 group-hover:text-white ${isFeatured ? "text-[0.68rem]" : "text-[0.6rem]"}`}>
                {t.categoryGrid.explore} <ArrowIcon className="h-3 w-3 rtl:rotate-180 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </span>
            </div>
          </Link>
        );
      })}
    </StaggerReveal>
  );
}
