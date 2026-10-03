"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]";
const LABEL_CLASS = "text-[0.72rem] uppercase tracking-[0.08em] text-[#7a6762]";

export function ImageUploadField({
  label,
  value,
  onChange,
  onFileSelected,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onFileSelected: (file: File | null) => void;
}) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Revoke the object URL when it's replaced or the field unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");

    if (!file.type.startsWith("image/")) {
      setError("يرجى اختيار ملف صورة.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("يجب ألا يتجاوز حجم الصورة 5 ميجابايت.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    onFileSelected(file);
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Typing a URL manually cancels any pending (not-yet-uploaded) file pick.
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onFileSelected(null);
    onChange(event.target.value);
  };

  return (
    <label htmlFor={inputId} className="block space-y-1.5 text-sm text-[#4e4442]">
      <span className={LABEL_CLASS}>{label}</span>
      <div className="flex items-center gap-3">
        {previewUrl || value ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[#e4d4cd] bg-white">
            {previewUrl ? (
              // Local, not-yet-uploaded preview — a blob: URL, not a remote
              // one, so next/image's optimizer/remotePatterns don't apply.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Image src={value} alt="" fill sizes="48px" className="object-cover" unoptimized />
            )}
          </div>
        ) : null}
        <input
          id={inputId}
          type="url"
          value={value}
          onChange={handleUrlChange}
          placeholder="https://... أو اختر ملفًا"
          className={`${INPUT_CLASS} flex-1`}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 whitespace-nowrap rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-[0.68rem] font-semibold text-[#4a4442] transition hover:bg-[#f2e7df]"
        >
          اختيار صورة
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      {previewUrl ? <p className="text-xs text-[#8a7c78]">تم اختيار الصورة — سيتم رفعها عند الحفظ.</p> : null}
      {error ? <p className="text-xs text-[#7a3a32]">{error}</p> : null}
    </label>
  );
}
