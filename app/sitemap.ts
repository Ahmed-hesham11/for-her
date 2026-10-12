import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { getCategories, getProducts } from "@/lib/storefront-data-server";

export const revalidate = 3600;

const STATIC_ROUTES = ["", "/products", "/categories", "/new-arrivals", "/best-sellers", "/offers", "/sale", "/jewelry", "/accessories", "/bags", "/contact-us"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
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
      .map((category) => ({ url: `${siteUrl}/categories/${category.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((product) => ({ url: `${siteUrl}/product/${product.id}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
