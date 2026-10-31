import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardSection } from "@/components/admin/dashboard-section";
import { ErrorState } from "@/components/admin/empty-state";
import { getAdminProductById, getAdminProductOptions, getSupplierOptions } from "@/lib/admin/products";
import { formatEgp } from "@/lib/currency";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Read-only product card reached from an invoice line — the editable form
// lives at /admin/products/[id].
export default async function AdminProductDetailsPage({
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

  const [product, options, supplierOptions] = await Promise.all([
    getAdminProductById(supabase, id),
    getAdminProductOptions(supabase, id),
    getSupplierOptions(supabase),
  ]);

  if (!product) {
    notFound();
  }

  const supplierNames = new Map(supplierOptions.map((supplier) => [supplier.id, supplier.name]));
  const gallery = Array.from(new Set([product.image_url, ...product.images].filter((url): url is string => Boolean(url))));
  const profit = product.selling_price - product.purchase_price;

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
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">تفاصيل المنتج · {product.category_name}</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">{product.name}</h1>
        <p className="mt-2 text-sm text-[#8a7c78]">
          {product.is_active ? "نشط" : "غير نشط"}
          {product.is_best_seller ? " · الأكثر مبيعًا" : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <DashboardSection title="الصور">
          {gallery.length > 0 ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- product images can come from any host, not just the allow-listed next/image hosts. */}
              <img src={gallery[0]} alt={product.name} className="max-h-[560px] w-full rounded-[16px] bg-[#f1e7e0] object-contain" />
              {gallery.length > 1 ? (
                <div className="grid grid-cols-4 gap-3">
                  {gallery.slice(1).map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-[12px] bg-[#f1e7e0]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- see above. */}
                      <img src={url} alt={product.name} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[#8a7c78]">لا توجد صور لهذا المنتج.</p>
          )}
        </DashboardSection>

        <div className="space-y-6">
          <DashboardSection title="الأسعار والمخزون">
            <div className="space-y-3 text-sm text-[#4a4442]">
              <div className="flex justify-between"><span>سعر البيع</span><span className="font-medium text-[#221d1b]">{formatEgp(product.selling_price)}</span></div>
              {product.original_price ? <div className="flex justify-between"><span>السعر قبل الخصم</span><span>{formatEgp(product.original_price)}</span></div> : null}
              <div className="flex justify-between"><span>سعر الشراء</span><span className="font-medium text-[#221d1b]">{formatEgp(product.purchase_price)}</span></div>
              <div className="flex justify-between"><span>الربح للقطعة</span><span>{formatEgp(profit)}</span></div>
              <div className="flex justify-between border-t border-[#eadfd7] pt-3"><span>المخزون الحالي</span><span className="font-medium text-[#221d1b]">{product.stock_quantity}</span></div>
            </div>
          </DashboardSection>

          <DashboardSection title="الموردون">
            {options.suppliers.length > 0 ? (
              <ul className="space-y-2 text-sm text-[#4a4442]">
                {options.suppliers.map((supplier) => (
                  <li key={supplier.supplier_id} className="flex justify-between gap-4">
                    <Link href={`/admin/suppliers/${supplier.supplier_id}`} className="font-medium text-[#221d1b] underline-offset-4 hover:underline">
                      {supplierNames.get(supplier.supplier_id) ?? "مورد غير معروف"}
                    </Link>
                    <span>{formatEgp(supplier.purchase_price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#8a7c78]">لا يوجد موردون مرتبطون بهذا المنتج.</p>
            )}
          </DashboardSection>

          {options.colors.length > 0 || options.sizes.length > 0 ? (
            <DashboardSection title="الألوان والمقاسات">
              <div className="space-y-3 text-sm text-[#4a4442]">
                {options.colors.length > 0 ? <p><span className="font-medium text-[#221d1b]">الألوان:</span> {options.colors.map((color) => color.name).join("، ")}</p> : null}
                {options.sizes.length > 0 ? <p><span className="font-medium text-[#221d1b]">المقاسات:</span> {options.sizes.map((size) => size.label).join("، ")}</p> : null}
              </div>
            </DashboardSection>
          ) : null}

          {product.description ? (
            <DashboardSection title="الوصف">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#4a4442]">{product.description}</p>
            </DashboardSection>
          ) : null}

          <Link href={`/admin/products/${product.id}`} className="inline-flex rounded-full border border-[#221d1b] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#1d1a19] transition hover:bg-[#1d1a19] hover:text-white">
            تعديل المنتج
          </Link>
        </div>
      </div>
    </div>
  );
}
