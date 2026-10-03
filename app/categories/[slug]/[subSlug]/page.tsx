import { notFound, redirect } from "next/navigation";
import { getCategories } from "@/lib/storefront-data-server";

export const dynamic = "force-dynamic";

export default async function SubcategoryPage({
  params,
}: {
  params: Promise<{ slug: string; subSlug: string }>;
}) {
  const { slug, subSlug } = await params;
  const normalizedParent = slug.toLowerCase();
  const normalizedSub = subSlug.toLowerCase();

  const categories = await getCategories();

  const parent = categories.find((item) => item.slug === normalizedParent);
  if (!parent) {
    notFound();
  }

  const subcategory = categories.find((item) => item.slug === normalizedSub && item.parentId === parent.id);
  if (!subcategory) {
    notFound();
  }

  // Reuse the /products page's sidebar + grid (CategorySidebar) instead of a
  // bespoke pill nav, so Clothes subcategories browse the same way every
  // other category does.
  redirect(`/products?category=${parent.slug}&subcategory=${subcategory.slug}`);
}
