"use client";

import { useEffect, useId, useRef, useState } from "react";
import { uploadMedia } from "@/lib/admin/upload-client";

// One image in an editable, ordered list. The first slot is the "main" image.
// A picked file is only a local preview (previewUrl) until the form is saved —
// uploadPendingSlots() is what actually uploads it then.
export type ImageSlot = { key: string; url: string; file: File | null; previewUrl: string | null };

// Mirrors what /api/admin/upload accepts for images (MAX_IMAGE_BYTES there).
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export function slotsFromUrls(urls: string[]): ImageSlot[] {
  return urls.filter(Boolean).map((url) => ({ key: crypto.randomUUID(), url, file: null, previewUrl: null }));
}

// product.image_url / color.image_url hold the main image; images[] the rest.
export function slotsFromMainAndExtras(main: string, extras: string[]): ImageSlot[] {
  return slotsFromUrls([main, ...extras]);
}

export function splitMainAndExtras(slots: ImageSlot[]): { image_url: string; images: string[] } {
  const urls = slots.map((slot) => slot.url.trim()).filter(Boolean);
  return { image_url: urls[0] ?? "", images: urls.slice(1) };
}

// Uploads every slot that still holds a local file and returns the slots with
// real URLs (empty slots dropped). Each newly uploaded URL is also pushed to
// `uploaded` so the caller can discard those files if the save fails later.
export async function uploadPendingSlots(slots: ImageSlot[], uploaded: string[]): Promise<ImageSlot[]> {
  const resolved: ImageSlot[] = [];
  for (const slot of slots) {
    if (slot.file) {
      const { url, error } = await uploadMedia(slot.file, "products");
      if (error || !url) throw new Error(error ?? "تعذّر رفع إحدى الصور الآن.");
      uploaded.push(url);
      resolved.push({ ...slot, url, file: null, previewUrl: null });
    } else if (slot.url.trim()) {
      resolved.push(slot);
    }
  }
  return resolved;
}

const SMALL_BUTTON = "rounded-full border border-[#e4d4cd] bg-white px-2.5 py-1 text-[0.64rem] font-medium text-[#4a4442] transition hover:bg-[#f2e7df] disabled:cursor-not-allowed disabled:opacity-40";

export function ImageListField({
  label,
  hint,
  slots,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  slots: ImageSlot[];
  onChange: (slots: ImageSlot[]) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceKeyRef = useRef<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [urlDraft, setUrlDraft] = useState("");
  const [failedKeys, setFailedKeys] = useState<Set<string>>(new Set());

  // Object URLs are revoked as soon as no slot uses them any more, and for
  // good when the field unmounts.
  const knownPreviews = useRef<Set<string>>(new Set());
  useEffect(() => {
    const current = new Set(slots.map((slot) => slot.previewUrl).filter((url): url is string => Boolean(url)));
    for (const url of knownPreviews.current) {
      if (!current.has(url)) {
        URL.revokeObjectURL(url);
        knownPreviews.current.delete(url);
      }
    }
    for (const url of current) knownPreviews.current.add(url);
  }, [slots]);
  useEffect(() => {
    const previews = knownPreviews.current;
    return () => {
      for (const url of previews) URL.revokeObjectURL(url);
      previews.clear();
    };
  }, []);

  const validate = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return `«${file.name}»: النوع غير مدعوم (JPG, PNG, WEBP, GIF, AVIF).`;
    if (file.size > MAX_FILE_BYTES) return `«${file.name}»: يجب ألا يتجاوز حجم الصورة 5 ميجابايت.`;
    return null;
  };

  const handleAddFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const problems: string[] = [];
    const added: ImageSlot[] = [];
    for (const file of files) {
      const problem = validate(file);
      if (problem) problems.push(problem);
      else added.push({ key: crypto.randomUUID(), url: "", file, previewUrl: URL.createObjectURL(file) });
    }
    setErrors(problems);
    if (added.length > 0) onChange([...slots, ...added]);
  };

  const handleReplaceFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const key = replaceKeyRef.current;
    replaceKeyRef.current = null;
    if (!file || !key) return;

    const problem = validate(file);
    setErrors(problem ? [problem] : []);
    if (problem) return;

    onChange(slots.map((slot) => (slot.key === key ? { ...slot, url: "", file, previewUrl: URL.createObjectURL(file) } : slot)));
    setFailedKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const handleAddUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
      setErrors(["الرابط يجب أن يبدأ بـ https://"]);
      return;
    }
    setErrors([]);
    setUrlDraft("");
    onChange([...slots, { key: crypto.randomUUID(), url, file: null, previewUrl: null }]);
  };

  const move = (index: number, to: number) => {
    if (to < 0 || to >= slots.length) return;
    const next = [...slots];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="text-[0.72rem] text-[#7a6762]">{label}</span>
        {hint ? <p className="mt-0.5 text-xs text-[#8a7c78]">{hint}</p> : null}
      </div>

      {slots.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {slots.map((slot, index) => {
            const src = slot.previewUrl ?? slot.url;
            const failed = failedKeys.has(slot.key);
            return (
              <li key={slot.key} className="min-w-0 space-y-2 rounded-[16px] border border-[#eadfd7] bg-white p-2">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[12px] bg-[#f1e7e0]">
                  {failed ? (
                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-[0.65rem] text-[#8a7c78]">تعذّر تحميل الصورة</div>
                  ) : (
                    // Admin-entered URLs can be from any host, and local previews are blob: URLs.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={() => setFailedKeys((current) => new Set(current).add(slot.key))}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {index === 0 ? (
                    <span className="absolute start-1.5 top-1.5 rounded-full bg-[#1d1a19] px-2 py-0.5 text-[0.6rem] font-semibold text-white">الرئيسية</span>
                  ) : null}
                  {slot.file ? (
                    <span className="absolute bottom-1.5 start-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[0.58rem] font-medium text-[#6b5a54]">يُرفع عند الحفظ</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {index > 0 ? (
                    <button type="button" disabled={disabled} onClick={() => move(index, 0)} className={SMALL_BUTTON}>
                      جعلها رئيسية
                    </button>
                  ) : null}
                  <button type="button" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} className={SMALL_BUTTON} aria-label="تقديم الصورة">
                    تقديم
                  </button>
                  <button type="button" disabled={disabled || index === slots.length - 1} onClick={() => move(index, index + 1)} className={SMALL_BUTTON} aria-label="تأخير الصورة">
                    تأخير
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      replaceKeyRef.current = slot.key;
                      replaceInputRef.current?.click();
                    }}
                    className={SMALL_BUTTON}
                  >
                    استبدال
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(slots.filter((item) => item.key !== slot.key))}
                    className={`${SMALL_BUTTON} text-[#8a3f34]`}
                  >
                    حذف
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-[14px] border border-dashed border-[#e4d4cd] bg-white/60 px-4 py-5 text-center text-xs text-[#8a7c78]">لا توجد صور بعد.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={disabled} onClick={() => addInputRef.current?.click()} className="rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-[0.68rem] font-semibold text-[#4a4442] transition hover:bg-[#f2e7df] disabled:opacity-50">
          + رفع صور
        </button>
        <input
          id={inputId}
          type="url"
          value={urlDraft}
          onChange={(event) => setUrlDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAddUrl();
            }
          }}
          placeholder="أو الصق رابط صورة https://..."
          aria-label="رابط صورة"
          disabled={disabled}
          className="min-w-0 flex-1 rounded-full border border-[#e4d4cd] bg-white px-4 py-2 text-xs outline-none focus:border-[#c8a78f]"
        />
        <button type="button" disabled={disabled || !urlDraft.trim()} onClick={handleAddUrl} className={SMALL_BUTTON}>
          إضافة رابط
        </button>
      </div>
      <input ref={addInputRef} type="file" accept={ALLOWED_TYPES.join(",")} multiple onChange={handleAddFiles} className="hidden" />
      <input ref={replaceInputRef} type="file" accept={ALLOWED_TYPES.join(",")} onChange={handleReplaceFile} className="hidden" />

      {errors.length > 0 ? (
        <ul role="alert" className="space-y-1 text-xs text-[#7a3a32]">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
