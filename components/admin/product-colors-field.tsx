"use client";

import { ImageListField, type ImageSlot } from "@/components/admin/image-list-field";
import { ProductVideoField, type VideoSlot } from "@/components/admin/product-video-field";

// A color being edited in the product form. `id` is set once the color exists
// in the database, so saving updates it in place instead of recreating it.
export type ColorDraft = { key: string; id?: string; name: string; slots: ImageSlot[]; videoSlots: VideoSlot[] };

export function newColorDraft(): ColorDraft {
  return { key: crypto.randomUUID(), name: "", slots: [], videoSlots: [] };
}

const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#c8a78f]";

export function ProductColorsField({
  colors,
  onChange,
  disabled = false,
}: {
  colors: ColorDraft[];
  onChange: (colors: ColorDraft[]) => void;
  disabled?: boolean;
}) {
  const update = (key: string, patch: Partial<ColorDraft>) => onChange(colors.map((color) => (color.key === key ? { ...color, ...patch } : color)));

  return (
    <section className="space-y-4 rounded-[16px] border border-[#eadfd7] bg-white/60 p-4" aria-label="ألوان المنتج">
      <div>
        <h2 className="text-sm font-semibold text-[#2b201d]">ألوان المنتج (اختياري)</h2>
        <p className="mt-0.5 text-xs text-[#8a7c78]">
          كل لون له صوره الخاصة؛ أول صورة هي الرئيسية. المنتج يبقى منتجًا واحدًا مهما تعددت ألوانه. بدون ألوان تُستخدم صور المنتج أعلاه.
        </p>
      </div>

      {colors.map((color, index) => (
        <div key={color.key} className="space-y-3 rounded-[16px] border border-[#eadfd7] bg-[#fbf8f5] p-3 sm:p-4">
          <div className="flex items-end gap-3">
            <label className="min-w-0 flex-1 space-y-1.5 text-sm text-[#4e4442]">
              <span className="text-[0.72rem] text-[#7a6762]">اسم اللون {index + 1}</span>
              <input
                value={color.name}
                onChange={(event) => update(color.key, { name: event.target.value })}
                maxLength={60}
                placeholder="مثال: أسود، بيج، وردي"
                disabled={disabled}
                className={INPUT_CLASS}
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(colors.filter((item) => item.key !== color.key))}
              className="shrink-0 rounded-full border border-[#e4d4cd] bg-white px-4 py-2.5 text-[0.68rem] font-medium text-[#8a3f34] transition hover:bg-[#f2e7df] disabled:opacity-50"
            >
              حذف اللون
            </button>
          </div>
          <ImageListField
            label="صور هذا اللون"
            slots={color.slots}
            onChange={(slots) => update(color.key, { slots })}
            disabled={disabled}
          />
          <ProductVideoField label="فيديوهات هذا اللون (اختياري)" slots={color.videoSlots} onChange={(videoSlots) => update(color.key, { videoSlots })} />
        </div>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...colors, newColorDraft()])}
        className="rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-[0.68rem] font-medium text-[#4a4442] transition hover:bg-[#f2e7df] disabled:opacity-50"
      >
        + إضافة لون
      </button>
    </section>
  );
}
