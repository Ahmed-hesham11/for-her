"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { CategoryTreeOption, ProductInput } from "@/lib/admin/products";
import { createProductAction, updateProductAction, uploadCatalogImageAction } from "@/lib/admin/actions";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { ProductGalleryField, type GalleryImageSlot } from "@/components/admin/product-gallery-field";

const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]";
const LABEL_CLASS = "text-[0.72rem] text-[#7a6762]";

const DEFAULT_PRODUCT: ProductInput = {
  name: "",
  sku: "",
  description: "",
  category_id: "",
  purchase_price: 0,
  selling_price: 0,
  original_price: null,
  image_url: "",
  images: [],
  is_active: true,
  is_best_seller: false,
  best_seller_order: null,
};

// Products no longer take a manually-typed SKU — a new product gets one
// generated automatically at save time (see handleSubmit).
function generateSku(): string {
  return `SKU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function validate(fields: ProductInput): string | null {
  if (!fields.name.trim()) return "اسم المنتج مطلوب.";
  if (!fields.category_id) return "الفئة مطلوبة.";
  if (Number.isNaN(fields.purchase_price) || fields.purchase_price < 0) return "يجب أن يكون سعر الشراء 0 أو أكثر.";
  if (Number.isNaN(fields.selling_price) || fields.selling_price < 0) return "يجب أن يكون سعر البيع 0 أو أكثر.";
  if (fields.original_price !== null && (!Number.isFinite(fields.original_price) || fields.original_price <= fields.selling_price)) return "يجب أن يكون السعر الأصلي أكبر من سعر البيع.";
  if (fields.best_seller_order !== null && (!Number.isInteger(fields.best_seller_order) || fields.best_seller_order < 0)) {
    return "يجب أن يكون ترتيب عرض الأكثر مبيعًا رقمًا صحيحًا 0 أو أكثر.";
  }
  return null;
}

export function ProductForm({
  categories,
  initialProduct,
  productId,
  currentStock,
}: {
  categories: CategoryTreeOption[];
  initialProduct?: ProductInput;
  productId?: string;
  currentStock?: number;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<ProductInput>(initialProduct ?? DEFAULT_PRODUCT);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [gallerySlots, setGallerySlots] = useState<GalleryImageSlot[]>(() =>
    (initialProduct?.images ?? []).map((url) => ({ key: crypto.randomUUID(), url, file: null })),
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Category is a two-step pick only when the chosen top-level category has
  // children (currently just Clothes) — every other category still saves
  // products.category_id directly, exactly as before this feature existed.
  const topLevelCategories = categories.filter((category) => !category.parent_id);
  const childrenOf = (parentId: string) => categories.filter((category) => category.parent_id === parentId);
  const [selectedTopId, setSelectedTopId] = useState(() => {
    const current = categories.find((category) => category.id === (initialProduct?.category_id ?? ""));
    if (!current) return "";
    return current.parent_id ?? current.id;
  });
  const subcategories = selectedTopId ? childrenOf(selectedTopId) : [];

  const update = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  const handleTopCategoryChange = (id: string) => {
    setSelectedTopId(id);
    const kids = childrenOf(id);
    // A category with subcategories can't be saved as-is — force an
    // explicit subcategory pick rather than leaving a stale/ambiguous value.
    update("category_id", kids.length > 0 ? "" : id);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validate(fields);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    try {
      // The image(s) only actually upload here, on save — not the moment
      // they were picked in the fields above.
      let submitFields = fields;
      if (pendingImageFile) {
        const { url, error: uploadError } = await uploadCatalogImageAction(pendingImageFile, "products");
        if (uploadError || !url) throw new Error(uploadError ?? "تعذّر رفع هذه الصورة الآن.");
        submitFields = { ...submitFields, image_url: url };
      }

      const resolvedGallerySlots: GalleryImageSlot[] = [];
      for (const slot of gallerySlots) {
        if (slot.file) {
          const { url, error: uploadError } = await uploadCatalogImageAction(slot.file, "products");
          if (uploadError || !url) throw new Error(uploadError ?? "تعذّر رفع إحدى الصور الإضافية الآن.");
          resolvedGallerySlots.push({ ...slot, url, file: null });
        } else if (slot.url.trim()) {
          resolvedGallerySlots.push(slot);
        }
      }
      submitFields = { ...submitFields, images: resolvedGallerySlots.map((slot) => slot.url) };

      if (!productId && !submitFields.sku.trim()) {
        submitFields = { ...submitFields, sku: generateSku() };
      }

      if (productId) {
        const { error: updateError } = await updateProductAction(productId, submitFields);
        if (updateError) throw new Error(updateError);
        setFields(submitFields);
        setPendingImageFile(null);
        setGallerySlots(resolvedGallerySlots);
        setSuccess("تم تحديث المنتج.");
        router.refresh();
      } else {
        const { id, error: createError } = await createProductAction(submitFields);
        if (createError || !id) throw new Error(createError ?? "تعذّر إنشاء المنتج.");
        router.push(`/admin/products/${id}`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذّر حفظ هذا المنتج الآن.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-6">
      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>اسم المنتج</span>
        <input value={fields.name} onChange={(event) => update("name", event.target.value)} className={INPUT_CLASS} required />
      </label>

      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>الوصف</span>
        <textarea rows={3} value={fields.description} onChange={(event) => update("description", event.target.value)} className="w-full rounded-[18px] border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]" />
      </label>

      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>الفئة</span>
        <select value={selectedTopId} onChange={(event) => handleTopCategoryChange(event.target.value)} className={INPUT_CLASS} required>
          <option value="">اختر فئة</option>
          {topLevelCategories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </label>

      {subcategories.length > 0 ? (
        <label className="block space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>فئة فرعية للملابس</span>
          <select value={fields.category_id} onChange={(event) => update("category_id", event.target.value)} className={INPUT_CLASS} required>
            <option value="">اختر فئة فرعية</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>سعر البيع</span>
          <input type="number" min="0" step="0.01" value={fields.selling_price} onChange={(event) => update("selling_price", Number(event.target.value))} className={INPUT_CLASS} required />
        </label>
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>السعر الأصلي (العرض)</span>
          <input type="number" min="0" step="0.01" value={fields.original_price ?? ""} onChange={(event) => update("original_price", event.target.value === "" ? null : Number(event.target.value))} placeholder="اتركه فارغًا إذا لم يكن ضمن عرض" className={INPUT_CLASS} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {productId ? (
          <div className="space-y-1.5 text-sm text-[#4e4442]">
            <span className={LABEL_CLASS}>المخزون الحالي</span>
            <div className="flex items-center rounded-full border border-[#e4d4cd] bg-[#f3ece6] px-4 py-3 text-sm text-[#5c524e]">
              {currentStock ?? 0} في المخزون
            </div>
            <p className="text-xs text-[#8a7c78]">يُحدَّد عبر المشتريات (المخزون المستلم) وطلبات العملاء — لا يمكن تعديله هنا.</p>
          </div>
        ) : (
          <div className="space-y-1.5 text-sm text-[#4e4442]">
            <span className={LABEL_CLASS}>كمية المخزون</span>
            <div className="flex items-center rounded-full border border-[#e4d4cd] bg-[#f3ece6] px-4 py-3 text-sm text-[#5c524e]">
              0 في المخزون
            </div>
            <p className="text-xs text-[#8a7c78]">تبدأ المنتجات الجديدة من 0 — أضف المخزون عبر المشتريات بعد إنشاء هذا المنتج.</p>
          </div>
        )}
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>سعر الشراء الحالي</span>
          <input type="number" min="0" step="0.01" value={fields.purchase_price} onChange={(event) => update("purchase_price", Number(event.target.value))} className={INPUT_CLASS} required />
          <p className="text-xs text-[#8a7c78]">يتحدّث أيضًا تلقائيًا من آخر عملية شراء مستلمة لهذا المنتج عبر المشتريات.</p>
        </label>
      </div>

      <ImageUploadField label="صورة المنتج" value={fields.image_url} onChange={(url) => update("image_url", url)} onFileSelected={setPendingImageFile} />

      <ProductGalleryField slots={gallerySlots} onChange={setGallerySlots} />

      <label className="flex items-center gap-3 text-sm text-[#524947]">
        <input type="checkbox" checked={fields.is_active} onChange={(event) => update("is_active", event.target.checked)} className="h-4 w-4 accent-[#1d1a19]" />
        <span>نشط (مرئي للعملاء)</span>
      </label>

      <div className="grid gap-4 rounded-[16px] border border-[#eadfd7] bg-white p-4 md:grid-cols-2 md:items-end">
        <label className="flex items-center gap-3 text-sm text-[#524947]">
          <input type="checkbox" checked={fields.is_best_seller} onChange={(event) => update("is_best_seller", event.target.checked)} className="h-4 w-4 accent-[#1d1a19]" />
          <span>الأكثر مبيعًا (يظهر في الصفحة الرئيسية)</span>
        </label>
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>ترتيب العرض (اختياري)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={fields.best_seller_order ?? ""}
            onChange={(event) => update("best_seller_order", event.target.value === "" ? null : Number(event.target.value))}
            placeholder="الأقل يظهر أولاً"
            disabled={!fields.is_best_seller}
            className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          />
        </label>
      </div>

      {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-[#cbe6d5] bg-[#eefaf3] px-3 py-2 text-sm text-[#1e5b3d]">{success}</p> : null}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSaving ? "جارٍ الحفظ..." : productId ? "حفظ التغييرات" : "إضافة منتج"}
      </button>
    </form>
  );
}
