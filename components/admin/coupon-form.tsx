"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { CouponInput } from "@/lib/admin/coupons";
import { createCouponAction, deleteCouponAction, updateCouponAction } from "@/lib/admin/actions";

const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]";
const LABEL_CLASS = "text-[0.72rem] text-[#7a6762]";

const DEFAULT_COUPON: CouponInput = {
  code: "",
  discount_type: "percentage",
  discount_value: 10,
  min_order_amount: null,
  max_uses: null,
  expires_at: null,
  is_active: true,
};

export function CouponForm({
  initialCoupon,
  couponId,
  usedCount = 0,
}: {
  initialCoupon?: CouponInput;
  couponId?: string;
  usedCount?: number;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<CouponInput>(initialCoupon ?? DEFAULT_COUPON);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const update = <K extends keyof CouponInput>(key: K, value: CouponInput[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (isSaving) return;
    setIsSaving(true);

    try {
      if (couponId) {
        const { error: updateError } = await updateCouponAction(couponId, fields);
        if (updateError) throw new Error(updateError);
        setSuccess("تم تحديث الكوبون.");
        router.refresh();
      } else {
        const { id, error: createError } = await createCouponAction(fields);
        if (createError || !id) throw new Error(createError ?? "تعذّر إنشاء الكوبون.");
        router.push(`/admin/coupons/${id}`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذّر حفظ هذا الكوبون الآن.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!couponId) return;
    if (!window.confirm("هل تريد حذف هذا الكوبون؟ لا يمكن التراجع عن هذا الإجراء.")) return;

    setIsDeleting(true);
    const { error: deleteError } = await deleteCouponAction(couponId);
    setIsDeleting(false);

    if (deleteError) {
      setError(deleteError);
      return;
    }
    router.push("/admin/coupons");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>كود الكوبون</span>
          <input value={fields.code} onChange={(event) => update("code", event.target.value.toUpperCase())} className={`${INPUT_CLASS} uppercase`} required />
        </label>
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>نوع الخصم</span>
          <select value={fields.discount_type} onChange={(event) => update("discount_type", event.target.value as "percentage" | "fixed")} className={INPUT_CLASS}>
            <option value="percentage">نسبة مئوية (%)</option>
            <option value="fixed">مبلغ ثابت</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>قيمة الخصم</span>
          <input type="number" min="0" step="0.01" value={fields.discount_value} onChange={(event) => update("discount_value", Number(event.target.value))} className={INPUT_CLASS} required />
        </label>
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>الحد الأدنى لمبلغ الطلب</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={fields.min_order_amount ?? ""}
            onChange={(event) => update("min_order_amount", event.target.value === "" ? null : Number(event.target.value))}
            placeholder="بدون حد أدنى"
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>الحد الأقصى للاستخدام</span>
          <input
            type="number"
            min="1"
            step="1"
            value={fields.max_uses ?? ""}
            onChange={(event) => update("max_uses", event.target.value === "" ? null : Number(event.target.value))}
            placeholder="غير محدود"
            className={INPUT_CLASS}
          />
        </label>
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>تاريخ الانتهاء</span>
          <input
            type="date"
            value={fields.expires_at ? fields.expires_at.slice(0, 10) : ""}
            onChange={(event) => update("expires_at", event.target.value ? new Date(event.target.value).toISOString() : null)}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      {couponId ? <p className="text-sm text-[#8a7c78]">استُخدم {usedCount} مرة.</p> : null}

      <label className="flex items-center gap-3 text-sm text-[#524947]">
        <input type="checkbox" checked={fields.is_active} onChange={(event) => update("is_active", event.target.checked)} className="h-4 w-4 accent-[#1d1a19]" />
        <span>نشط</span>
      </label>

      {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-[#cbe6d5] bg-[#eefaf3] px-3 py-2 text-sm text-[#1e5b3d]">{success}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? "جارٍ الحفظ..." : couponId ? "حفظ التغييرات" : "إنشاء كوبون"}
        </button>

        {couponId && usedCount === 0 ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="rounded-full border border-[#e5b8ac] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8a3f34] transition hover:bg-[#fff5f3] disabled:opacity-60"
          >
            {isDeleting ? "جارٍ الحذف..." : "حذف الكوبون"}
          </button>
        ) : couponId ? (
          <p className="text-xs text-[#8a7c78]">تم استخدام هذا الكوبون ولا يمكن حذفه — قم بإلغاء تفعيله بدلاً من ذلك.</p>
        ) : null}
      </div>
    </form>
  );
}
