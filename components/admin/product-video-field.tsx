"use client";

import { useEffect, useRef, useState } from "react";

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export type VideoSlot = { key: string; url: string; file: File | null; previewUrl: string | null };

// Same pending-File-until-save pattern as ProductGalleryField — a picked
// video is only a local preview until the form is saved, when the caller
// uploads it directly to Storage and swaps in the final public URL.
export function ProductVideoField({
  slots,
  onChange,
}: {
  slots: VideoSlot[];
  onChange: (slots: VideoSlot[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  // Latest slots, so unmount cleanup can revoke whatever preview URLs remain.
  const slotsRef = useRef(slots);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);
  useEffect(() => {
    return () => slotsRef.current.forEach((slot) => slot.previewUrl && URL.revokeObjectURL(slot.previewUrl));
  }, []);

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError("");

    const added: VideoSlot[] = [];
    for (const file of files) {
      if (!file.type.startsWith("video/")) {
        setError("يرجى اختيار ملفات فيديو فقط.");
        continue;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        setError("يجب ألا يتجاوز حجم الفيديو 200 ميجابايت.");
        continue;
      }
      added.push({ key: crypto.randomUUID(), url: "", file, previewUrl: URL.createObjectURL(file) });
    }
    if (added.length > 0) onChange([...slots, ...added]);
  };

  const removeSlot = (key: string) => {
    const slot = slots.find((item) => item.key === key);
    if (slot?.previewUrl) URL.revokeObjectURL(slot.previewUrl);
    onChange(slots.filter((item) => item.key !== key));
  };

  return (
    <div className="space-y-3">
      <span className="text-[0.72rem] text-[#7a6762]">فيديوهات (اختياري)</span>
      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map((slot, index) => (
          <div key={slot.key} className="space-y-2 rounded-[16px] border border-[#eadfd7] bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="text-[0.68rem] text-[#8a7c78]">فيديو {index + 1}</span>
              <button type="button" onClick={() => removeSlot(slot.key)} className="text-[0.68rem] font-medium text-[#8a3f34] hover:underline">
                إزالة
              </button>
            </div>
            <video src={slot.previewUrl ?? slot.url} controls preload="metadata" className="aspect-video w-full rounded-[12px] bg-black object-contain" />
            {slot.file ? <p className="text-xs text-[#8a7c78]">سيتم رفعه عند الحفظ.</p> : null}
          </div>
        ))}
      </div>
      <input ref={inputRef} type="file" accept="video/*" multiple onChange={handleFiles} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-full border border-[#e4d4cd] px-4 py-2 text-[0.68rem] font-medium text-[#4a4442] transition hover:bg-[#f2e7df]"
      >
        + إضافة فيديو
      </button>
      <p className="text-xs text-[#8a7c78]">الحد الأقصى لحجم الفيديو 200 ميجابايت (MP4 أو WebM مفضّل).</p>
      {error ? <p className="text-xs text-[#7a3a32]">{error}</p> : null}
    </div>
  );
}
