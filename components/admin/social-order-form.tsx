"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createManualOrderAction, uploadCatalogImageAction } from "@/lib/admin/actions";
import type { ProductPricedOption } from "@/lib/admin/products";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { ProductPicker } from "@/components/admin/product-picker";
import type { AdminShippingRate } from "@/lib/admin/shipping";
import { formatEgp } from "@/lib/currency";

const INPUT_CLASS = "w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#c8a78f]";
const LABEL_CLASS = "text-[0.72rem] text-[#7a6762]";

type LineItem = {
  key: string;
  isCustom: boolean;
  product_id: string;
  // Defaults to the picked product's selling_price, but the admin can type
  // over it — a per-order price override, not a change to the product.
  unitPrice: number;
  customName: string;
  customPrice: number;
  customImageUrl: string;
  customImageFile: File | null;
  quantity: number;
};

function emptyLine(): LineItem {
  return {
    key: crypto.randomUUID(),
    isCustom: false,
    product_id: "",
    unitPrice: 0,
    customName: "",
    customPrice: 0,
    customImageUrl: "",
    customImageFile: null,
    quantity: 1,
  };
}

export function SocialOrderForm({ products, shippingRates }: { products: ProductPricedOption[]; shippingRates: AdminShippingRate[] }) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "card">("cod");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const activeRates = shippingRates.filter((rate) => rate.is_active);
  const productById = new Map(products.map((product) => [product.id, product]));

  const updateLine = (key: string, patch: Partial<LineItem>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const addLine = () => setLines((current) => [...current, emptyLine()]);
  const removeLine = (key: string) => setLines((current) => (current.length > 1 ? current.filter((line) => line.key !== key) : current));

  const subtotal = lines.reduce((sum, line) => {
    const unitPrice = line.isCustom ? line.customPrice : line.unitPrice;
    return sum + unitPrice * line.quantity;
  }, 0);
  const shippingFee = activeRates.find((rate) => rate.governorate === governorate)?.shipping_fee ?? 0;
  const total = subtotal + shippingFee;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (isSaving) return;
    setIsSaving(true);

    try {
      // A custom line's image only actually uploads here, on save — same
      // deferred-upload pattern as ProductForm's cover image.
      const items = await Promise.all(
        lines.map(async (line) => {
          if (!line.isCustom) {
            return { product_id: line.product_id, custom_name: null, unit_price: line.unitPrice, image_url: null, quantity: line.quantity };
          }

          let imageUrl = line.customImageUrl || null;
          if (line.customImageFile) {
            const { url, error: uploadError } = await uploadCatalogImageAction(line.customImageFile, "orders");
            if (uploadError || !url) throw new Error(uploadError ?? "تعذّر رفع صورة هذا المنتج الآن.");
            imageUrl = url;
          }

          return { product_id: null, custom_name: line.customName, unit_price: line.customPrice, image_url: imageUrl, quantity: line.quantity };
        }),
      );

      const { id, error: createError } = await createManualOrderAction({
        customer_name: customerName,
        phone_1: phone1,
        phone_2: phone2,
        governorate,
        address,
        payment_method: paymentMethod,
        notes,
        discount: 0,
        items,
      });
      if (createError || !id) throw new Error(createError ?? "تعذّر تسجيل الطلب.");
      router.push(`/admin/orders/${id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذّر تسجيل هذا الطلب الآن.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>اسم العميل</span>
          <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={INPUT_CLASS} required />
        </label>
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>المحافظة</span>
          <select value={governorate} onChange={(event) => setGovernorate(event.target.value)} className={INPUT_CLASS} required>
            <option value="">اختر محافظة</option>
            {activeRates.map((rate) => (
              <option key={rate.id} value={rate.governorate}>{rate.governorate} — {formatEgp(rate.shipping_fee)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>رقم الهاتف</span>
          <input value={phone1} onChange={(event) => setPhone1(event.target.value)} className={INPUT_CLASS} required />
        </label>
        <label className="space-y-1.5 text-sm text-[#4e4442]">
          <span className={LABEL_CLASS}>رقم هاتف إضافي (اختياري)</span>
          <input value={phone2} onChange={(event) => setPhone2(event.target.value)} className={INPUT_CLASS} />
        </label>
      </div>

      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>العنوان</span>
        <textarea rows={2} value={address} onChange={(event) => setAddress(event.target.value)} className="w-full rounded-[18px] border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]" required />
      </label>

      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>طريقة الدفع</span>
        <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "cod" | "card")} className={INPUT_CLASS}>
          <option value="cod">نقدًا عند الاستلام (COD)</option>
          <option value="card">مدفوع مسبقًا (تحويل / إنستاباي)</option>
        </select>
      </label>

      <div>
        <p className={`mb-3 ${LABEL_CLASS}`}>عناصر الطلب</p>
        <div className="space-y-3">
          {lines.map((line) => {
            return (
              <div key={line.key} className="space-y-2 rounded-[16px] border border-[#eadfd7] bg-white p-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[0.68rem] text-[#8a7c78]">
                    <input
                      type="checkbox"
                      checked={line.isCustom}
                      onChange={(event) =>
                        updateLine(line.key, {
                          isCustom: event.target.checked,
                          product_id: "",
                          customName: "",
                          customPrice: 0,
                          customImageUrl: "",
                          customImageFile: null,
                        })
                      }
                      className="h-3.5 w-3.5 accent-[#1d1a19]"
                    />
                    منتج جديد (مش موجود في الموقع)
                  </label>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    className="text-[0.68rem] font-medium text-[#8a3f34] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    إزالة
                  </button>
                </div>

                {line.isCustom ? (
                  <div className="grid gap-2 sm:grid-cols-[1.4fr_110px_90px_110px] sm:items-center">
                    <input
                      value={line.customName}
                      onChange={(event) => updateLine(line.key, { customName: event.target.value })}
                      placeholder="اسم المنتج"
                      className={INPUT_CLASS}
                      required
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.customPrice}
                      onChange={(event) => updateLine(line.key, { customPrice: Number(event.target.value) })}
                      placeholder="سعر الوحدة"
                      className={INPUT_CLASS}
                      required
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })}
                      placeholder="الكمية"
                      className={INPUT_CLASS}
                      required
                    />
                    <div className="flex items-center rounded-full border border-[#e4d4cd] bg-[#f3ece6] px-4 py-2.5 text-sm text-[#5c524e]">
                      {formatEgp(line.customPrice * line.quantity)}
                    </div>
                    <div className="sm:col-span-4">
                      <ImageUploadField
                        label="صورة المنتج (اختياري)"
                        value={line.customImageUrl}
                        onChange={(url) => updateLine(line.key, { customImageUrl: url, customImageFile: null })}
                        onFileSelected={(file) => updateLine(line.key, { customImageFile: file })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-[1fr_90px_110px] sm:items-center">
                    <ProductPicker
                      products={products}
                      value={line.product_id}
                      onChange={(productId) => updateLine(line.key, { product_id: productId, unitPrice: productById.get(productId)?.selling_price ?? 0 })}
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })}
                      placeholder="الكمية"
                      className={INPUT_CLASS}
                      required
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(event) => updateLine(line.key, { unitPrice: Number(event.target.value) })}
                      placeholder="سعر الوحدة"
                      className={INPUT_CLASS}
                      required
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-3 rounded-full border border-[#e4d4cd] px-4 py-2 text-[0.68rem] font-medium text-[#4a4442] transition hover:bg-[#f2e7df]"
        >
          + إضافة سطر
        </button>
      </div>

      <label className="block space-y-1.5 text-sm text-[#4e4442]">
        <span className={LABEL_CLASS}>ملاحظات (اختياري)</span>
        <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-[18px] border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]" />
      </label>

      <div className="space-y-2 border-t border-[#eadfd7] pt-4 text-sm text-[#4a4442]">
        <div className="flex justify-between"><span>الإجمالي الفرعي</span><span>{formatEgp(subtotal)}</span></div>
        <div className="flex justify-between"><span>الشحن</span><span>{formatEgp(shippingFee)}</span></div>
        <div className="flex justify-between text-base font-semibold text-[#1d1918]"><span>الإجمالي</span><span>{formatEgp(total)}</span></div>
      </div>

      {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSaving ? "جارٍ التسجيل..." : "تسجيل الطلب"}
      </button>
    </form>
  );
}
