"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { CategoryInput, CategoryOption } from "@/lib/admin/categories";
import { createCategoryAction, updateCategoryAction, uploadCatalogImageAction } from "@/lib/admin/actions";
import { ImageUploadField } from "@/components/admin/image-upload-field";

const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]";
const LABEL_CLASS = "text-[0.72rem] text-[#7a6762]";

const DEFAULT_CATEGORY: CategoryInput = { name: "", image_url: "", is_active: true, parent_id: null };

export function CategoryForm({
  parentOptions,
  initialCategory,
  categoryId,
}: {
  parentOptions: CategoryOption[];
  initialCategory?: CategoryInput;
  categoryId?: string;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<CategoryInput>(initialCategory ?? DEFAULT_CATEGORY);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const update = <K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!fields.name.trim()) {
      setError("اسم الفئة مطلوب.");
      return;
    }
    if (isSaving) return;
    setIsSaving(true);

    try {
      // The image only actually uploads here, on save — not the moment it
      // was picked in the field above.
      let submitFields = fields;
      if (pendingImageFile) {
        const { url, error: uploadError } = await uploadCatalogImageAction(pendingImageFile, "categories");
        if (uploadError || !url) throw new Error(uploadError ?? "تعذّر رفع هذه الصورة الآن.");
        submitFields = { ...fields, image_url: url };
      }

      if (categoryId) {
        const { error: updateError } = await updateCategoryAction(categoryId, submitFields);
        if (updateError) throw new Error(updateError);
        setFields(submitFields);
        setPendingImageFile(null);
        setSuccess("تم تحديث الفئة.");
        router.refresh();
      } else {
        const { id, error: createError } = await createCategoryAction(submitFields);
        if (createError || !id) throw new Error(createError ?? "تعذّر إنشاء الفئة.");
        router.push(`/admin/categories/${id}`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذّر حفظ هذه الفئة الآن.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-6">
      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>اسم الفئة</span>
        <input value={fields.name} onChange={(event) => update("name", event.target.value)} className={INPUT_CLASS} required />
      </label>

      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>الفئة الأم (اختياري)</span>
        <select value={fields.parent_id ?? ""} onChange={(event) => update("parent_id", event.target.value || null)} className={INPUT_CLASS}>
          <option value="">بلا — فئة رئيسية</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
        <p className="text-xs text-[#8a7c78]">استخدم هذا فقط لفئة فرعية للملابس (مثل الفئة الأم &ldquo;Clothes&rdquo;). اتركه &ldquo;بلا&rdquo; لفئة مستقلة عادية.</p>
      </label>

      <ImageUploadField label="صورة الفئة" value={fields.image_url} onChange={(url) => update("image_url", url)} onFileSelected={setPendingImageFile} />

      <label className="flex items-center gap-3 text-sm text-[#524947]">
        <input type="checkbox" checked={fields.is_active} onChange={(event) => update("is_active", event.target.checked)} className="h-4 w-4 accent-[#1d1a19]" />
        <span>نشط (مرئي للعملاء)</span>
      </label>

      {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-[#cbe6d5] bg-[#eefaf3] px-3 py-2 text-sm text-[#1e5b3d]">{success}</p> : null}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSaving ? "جارٍ الحفظ..." : categoryId ? "حفظ التغييرات" : "إضافة فئة"}
      </button>
    </form>
  );
}
