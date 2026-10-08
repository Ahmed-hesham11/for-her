import { notFound } from "next/navigation";
import { ErrorState } from "@/components/admin/empty-state";
import { ProductForm } from "@/components/admin/product-form";
import { getAdminProductById, getCategoryOptions } from "@/lib/admin/products";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const [product, categories] = await Promise.all([
    getAdminProductById(supabase, id),
    getCategoryOptions(supabase),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">الكتالوج</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">{product.name}</h1>
        <p className="mt-1 text-sm text-[#8a7c78]">رمز المنتج: {product.sku}</p>
      </div>

      <ProductForm
        productId={product.id}
        categories={categories}
        currentStock={product.stock_quantity}
        initialProduct={{
          name: product.name,
          sku: product.sku,
          description: product.description ?? "",
          category_id: product.category_id,
          purchase_price: product.purchase_price,
          selling_price: product.selling_price,
          original_price: product.original_price,
          image_url: product.image_url ?? "",
          images: product.images,
          is_active: product.is_active,
          is_best_seller: product.is_best_seller,
          best_seller_order: product.best_seller_order,
        }}
      />
    </div>
  );
}
