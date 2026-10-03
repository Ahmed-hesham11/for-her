"use client";

import { WhatsAppIcon } from "@/components/icons";
import { formatEgp } from "@/lib/currency";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export function WhatsAppConfirmButton({
  phone,
  customerName,
  orderNumber,
  totalAmount,
}: {
  phone: string;
  customerName: string;
  orderNumber: number | null;
  totalAmount: number;
}) {
  const message = `مرحباً ${customerName}، معاكي من FOR HER 🤍\nبنأكد طلبك رقم #${orderNumber ?? ""} بإجمالي ${formatEgp(totalAmount)}.\nتحبي نكمل الطلب؟`;

  return (
    <a
      href={buildWhatsAppLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25d366]/12 text-[#1f9e56] transition hover:bg-[#25d366]/20"
      title="تأكيد الطلب عبر واتساب"
    >
      <WhatsAppIcon className="h-4 w-4" />
    </a>
  );
}
