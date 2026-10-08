"use client";

import { ImageUploadField } from "@/components/admin/image-upload-field";

export type GalleryImageSlot = { key: string; url: string; file: File | null };

// Mirrors the single-cover-image pattern in ProductForm/ImageUploadField —
// a file picked here is only a local preview + pending File until the form
// is actually saved; it's the caller's handleSubmit that uploads each
// pending slot (via uploadCatalogImageAction) and resolves the final URLs.
export function ProductGalleryField({
  slots,
  onChange,
}: {
  slots: GalleryImageSlot[];
  onChange: (slots: GalleryImageSlot[]) => void;
}) {
  const addSlot = () => onChange([...slots, { key: crypto.randomUUID(), url: "", file: null }]);
  const removeSlot = (key: string) => onChange(slots.filter((slot) => slot.key !== key));
  const updateSlot = (key: string, patch: Partial<GalleryImageSlot>) =>
    onChange(slots.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)));

  return (
    <div className="space-y-3">
      <span className="text-[0.72rem] text-[#7a6762]">صور إضافية (اختياري)</span>
      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map((slot, index) => (
          <div key={slot.key} className="space-y-2 rounded-[16px] border border-[#eadfd7] bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="text-[0.68rem] text-[#8a7c78]">صورة {index + 1}</span>
              <button type="button" onClick={() => removeSlot(slot.key)} className="text-[0.68rem] font-medium text-[#8a3f34] hover:underline">
                إزالة
              </button>
            </div>
            <ImageUploadField
              value={slot.url}
              onChange={(url) => updateSlot(slot.key, { url, file: null })}
              onFileSelected={(file) => updateSlot(slot.key, { file })}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addSlot}
        className="rounded-full border border-[#e4d4cd] px-4 py-2 text-[0.68rem] font-medium text-[#4a4442] transition hover:bg-[#f2e7df]"
      >
        + إضافة صورة
      </button>
    </div>
  );
}
