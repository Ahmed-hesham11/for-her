"use client";

import { useState } from "react";

// A size label being edited. `id` is set once the size exists in the database.
export type SizeDraft = { key: string; id?: string; label: string };

export function newSizeDraft(label = ""): SizeDraft {
  return { key: crypto.randomUUID(), label };
}

const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#c8a78f]";
const SMALL_BUTTON = "rounded-full border border-[#e4d4cd] bg-white px-2.5 py-1 text-[0.64rem] font-medium text-[#4a4442] transition hover:bg-[#f2e7df] disabled:cursor-not-allowed disabled:opacity-40";

// Convenience only — any custom label can be typed instead.
const PRESETS = [
  { name: "ملابس: XS – XXL", labels: ["XS", "S", "M", "L", "XL", "XXL"] },
  { name: "أحذية: 37 – 42", labels: ["37", "38", "39", "40", "41", "42"] },
  { name: "مقاس واحد", labels: ["One Size"] },
];

export function ProductSizesField({
  hasSizes,
  onHasSizesChange,
  sizes,
  onChange,
  disabled = false,
}: {
  hasSizes: boolean;
  onHasSizesChange: (value: boolean) => void;
  sizes: SizeDraft[];
  onChange: (sizes: SizeDraft[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const addLabels = (labels: string[]) => {
    const existing = new Set(sizes.map((size) => size.label.trim().toLowerCase()));
    const additions = labels
      .map((label) => label.trim())
      .filter((label, index, all) => label && !existing.has(label.toLowerCase()) && all.findIndex((other) => other.toLowerCase() === label.toLowerCase()) === index)
      .map((label) => newSizeDraft(label));
    if (additions.length > 0) onChange([...sizes, ...additions]);
  };

  const commitDraft = () => {
    addLabels([draft]);
    setDraft("");
  };

  const move = (index: number, to: number) => {
    if (to < 0 || to >= sizes.length) return;
    const next = [...sizes];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const hasDuplicate = (size: SizeDraft) =>
    size.label.trim() !== "" && sizes.some((other) => other.key !== size.key && other.label.trim().toLowerCase() === size.label.trim().toLowerCase());

  return (
    <section className="space-y-4 rounded-[16px] border border-[#eadfd7] bg-white/60 p-4" aria-label="مقاسات المنتج">
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-semibold text-[#2b201d]">هل لهذا المنتج مقاسات؟</legend>
        <div className="flex gap-4 text-sm text-[#524947]">
          <label className="flex items-center gap-2">
            <input type="radio" name="has-sizes" checked={hasSizes} onChange={() => onHasSizesChange(true)} className="h-4 w-4 accent-[#1d1a19]" />
            <span>نعم</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="has-sizes" checked={!hasSizes} onChange={() => onHasSizesChange(false)} className="h-4 w-4 accent-[#1d1a19]" />
            <span>لا</span>
          </label>
        </div>
        {!hasSizes ? <p className="text-xs text-[#8a7c78]">لن يُطلب من العميل اختيار مقاس لهذا المنتج.</p> : null}
      </fieldset>

      {hasSizes ? (
        <div className="space-y-3">
          <p className="text-xs text-[#8a7c78]">المقاسات المضافة هنا فقط هي التي تظهر للعميل، ويجب إضافة مقاس واحد على الأقل. يمكنك كتابة أي اسم مقاس.</p>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button key={preset.name} type="button" disabled={disabled} onClick={() => addLabels(preset.labels)} className={SMALL_BUTTON}>
                {preset.name}
              </button>
            ))}
          </div>

          {sizes.length > 0 ? (
            <ul className="space-y-2">
              {sizes.map((size, index) => (
                <li key={size.key} className="flex flex-wrap items-center gap-2">
                  <input
                    value={size.label}
                    onChange={(event) => onChange(sizes.map((item) => (item.key === size.key ? { ...item, label: event.target.value } : item)))}
                    maxLength={30}
                    aria-label={`المقاس ${index + 1}`}
                    aria-invalid={hasDuplicate(size)}
                    disabled={disabled}
                    className={`${INPUT_CLASS} !w-40 ${hasDuplicate(size) ? "border-[#d9a79d]" : ""}`}
                  />
                  <button type="button" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} className={SMALL_BUTTON} aria-label="تقديم المقاس">
                    تقديم
                  </button>
                  <button type="button" disabled={disabled || index === sizes.length - 1} onClick={() => move(index, index + 1)} className={SMALL_BUTTON} aria-label="تأخير المقاس">
                    تأخير
                  </button>
                  <button type="button" disabled={disabled} onClick={() => onChange(sizes.filter((item) => item.key !== size.key))} className={`${SMALL_BUTTON} text-[#8a3f34]`}>
                    حذف
                  </button>
                  {hasDuplicate(size) ? <span className="text-xs text-[#7a3a32]">مقاس مكرر</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[14px] border border-dashed border-[#e4d4cd] bg-white/60 px-4 py-4 text-center text-xs text-[#8a7c78]">لم تتم إضافة مقاسات بعد.</p>
          )}

          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitDraft();
                }
              }}
              maxLength={30}
              placeholder="مقاس جديد (مثال: M أو 40)"
              aria-label="مقاس جديد"
              disabled={disabled}
              className={`${INPUT_CLASS} !w-52`}
            />
            <button type="button" disabled={disabled || !draft.trim()} onClick={commitDraft} className="rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-[0.68rem] font-medium text-[#4a4442] transition hover:bg-[#f2e7df] disabled:opacity-50">
              + إضافة
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
