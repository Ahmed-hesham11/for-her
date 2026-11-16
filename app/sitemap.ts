import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { getActiveProductIds, getCategories } from "@/lib/storefront-data-server";

export const revalidate = 21600;

const STATIC_ROUTES = ["", "/products", "/categories", "/new-arrivals", "/best-sellers", "/offers", "/sale", "/jewelry", "/accessories", "/bags", "/contact-us"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const [productIds, categories] = await Promise.all([getActiveProductIds().catch(() => []), getCategories()]);
  const parentIds = new Set(categories.map((category) => category.parentId).filter(Boolean));

  return [
    ...STATIC_ROUTES.map((path) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: path === "" ? ("daily" as const) : ("weekly" as const),
      priority: path === "" ? 1 : 0.7,
    })),
    // Only categories with subcategories have their own hub page; the rest
    // redirect to /products?category=…, which isn't worth indexing.
    ...categories
      .filter((category) => parentIds.has(category.id))
      .map((category) => ({ url: `${siteUrl}/categories/${encodeURIComponent(category.slug)}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...productIds.map((id) => ({ url: `${siteUrl}/product/${id}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
