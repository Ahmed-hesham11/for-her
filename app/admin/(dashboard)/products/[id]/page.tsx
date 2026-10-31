import { notFound } from "next/navigation";
import Link from "next/link";
import { ErrorState } from "@/components/admin/empty-state";
import { ProductForm } from "@/components/admin/product-form";
import { getAdminProductById, getAdminProductOptions, getCategoryOptions, getSupplierOptions } from "@/lib/admin/products";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  // Only same-site admin paths — this value comes from the URL.
  const backHref = from && /^\/admin\/(orders|purchases)\/[\w-]+$/.test(from) ? from : null;
  const backLabel = backHref?.startsWith("/admin/orders") ? "الرجوع إلى الطلب" : "الرجوع إلى الفاتورة";
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const [product, categories, suppliers, options] = await Promise.all([
    getAdminProductById(supabase, id),
    getCategoryOptions(supabase),
    getSupplierOptions(supabase),
    getAdminProductOptions(supabase, id),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        {backHref ? (
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#f6dcd6] px-4 py-2 text-xs font-semibold text-[#8a3f34] transition hover:bg-[#f0c9c1]"
          >
            → {backLabel}
          </Link>
        ) : null}
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">الكتالوج</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">{product.name}</h1>
      </div>

      <ProductForm
        productId={product.id}
        categories={categories}
        suppliers={suppliers}
        currentStock={product.stock_quantity}
        initialProduct={{
          name: product.name,
          description: product.description ?? "",
          category_id: product.category_id,
          purchase_price: product.purchase_price,
          selling_price: product.selling_price,
          original_price: product.original_price,
          image_url: product.image_url ?? "",
          images: product.images,
          videos: product.videos,
          is_active: product.is_active,
          is_best_seller: product.is_best_seller,
          best_seller_order: product.best_seller_order,
          has_sizes: product.has_sizes,
          colors: options.colors,
          sizes: options.sizes,
          suppliers: options.suppliers,
        }}
      />
    </div>
  );
}
