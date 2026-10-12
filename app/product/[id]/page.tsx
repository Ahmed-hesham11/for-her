import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/product-detail-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getProductById, getRelatedProducts } from "@/lib/storefront-data-server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "Product not found", robots: { index: false } };

  const description = (product.description || `${product.name} - ${product.category}`).replace(/\s+/g, " ").trim().slice(0, 160);
  const image = absoluteUrl(product.image);
  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${product.id}` },
    openGraph: { type: "website", title: product.name, description, url: `/product/${product.id}`, images: [{ url: image, alt: product.name }] },
    twitter: { card: "summary_large_image", title: product.name, description, images: [image] },
  };
}

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description || undefined,
            sku: product.sku || undefined,
            image: [product.image, ...(product.gallery ?? [])].map(absoluteUrl),
            category: product.category,
            brand: { "@type": "Brand", name: SITE_NAME },
            offers: {
              "@type": "Offer",
              priceCurrency: "EGP",
              price: product.price,
              availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url: absoluteUrl(`/product/${product.id}`),
            },
          }).replace(/</g, "\\u003c"),
        }}
      />
      <SiteHeader />
      <ProductDetailClient product={product} related={related} />
      <SiteFooter />
    </>
  );
}
