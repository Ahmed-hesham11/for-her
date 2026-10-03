"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { SupplierInput } from "@/lib/admin/suppliers";
import { createSupplierAction, updateSupplierAction } from "@/lib/admin/actions";

const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]";
const LABEL_CLASS = "text-[0.72rem] text-[#7a6762]";

const DEFAULT_SUPPLIER: SupplierInput = { name: "", phone: "", email: "", address: "", notes: "", is_active: true };

export function SupplierForm({
  initialSupplier,
  supplierId,
}: {
  initialSupplier?: SupplierInput;
  supplierId?: string;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<SupplierInput>(initialSupplier ?? DEFAULT_SUPPLIER);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const update = <K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!fields.name.trim()) {
      setError("اسم المورد مطلوب.");
      return;
    }
    if (isSaving) return;
    setIsSaving(true);

    try {
      if (supplierId) {
        const { error: updateError } = await updateSupplierAction(supplierId, fields);
        if (updateError) throw new Error(updateError);
        setSuccess("تم تحديث المورد.");
        router.refresh();
      } else {
        const { id, error: createError } = await createSupplierAction(fields);
        if (createError || !id) throw new Error(createError ?? "تعذّر إنشاء المورد.");
        router.push("/admin/suppliers");
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذّر حفظ هذا المورد الآن.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-6">
      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>اسم المورد</span>
        <input value={fields.name} onChange={(event) => update("name", event.target.value)} className={INPUT_CLASS} required />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>الهاتف</span>
          <input value={fields.phone} onChange={(event) => update("phone", event.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>البريد الإلكتروني</span>
          <input type="email" value={fields.email} onChange={(event) => update("email", event.target.value)} className={INPUT_CLASS} />
        </label>
      </div>

      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>العنوان</span>
        <input value={fields.address} onChange={(event) => update("address", event.target.value)} className={INPUT_CLASS} />
      </label>

      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>ملاحظات</span>
        <textarea rows={3} value={fields.notes} onChange={(event) => update("notes", event.target.value)} className="w-full rounded-[18px] border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]" />
      </label>

      <label className="flex items-center gap-3 text-sm text-[#524947]">
        <input type="checkbox" checked={fields.is_active} onChange={(event) => update("is_active", event.target.checked)} className="h-4 w-4 accent-[#1d1a19]" />
        <span>نشط</span>
      </label>

      {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-[#cbe6d5] bg-[#eefaf3] px-3 py-2 text-sm text-[#1e5b3d]">{success}</p> : null}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSaving ? "جارٍ الحفظ..." : supplierId ? "حفظ التغييرات" : "إضافة مورد"}
      </button>
    </form>
  );
}
