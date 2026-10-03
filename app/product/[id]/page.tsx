import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/product-detail-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getProductById, getRelatedProducts } from "@/lib/storefront-data-server";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const related = await getRelatedProducts(product.category, product.id, 4);

  return (
    <>
      <SiteHeader />
      <ProductDetailClient product={product} related={related} />
      <SiteFooter />
    </>
  );
}
