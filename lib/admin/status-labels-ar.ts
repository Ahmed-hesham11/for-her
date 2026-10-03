// Arabic display labels for the status enum values stored in the database.
// The underlying values (e.g. "pending", "shipped") are never translated —
// they're literal DB/enum values written back on update — only what's shown
// to the admin changes here.
export const ORDER_STATUS_LABELS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
};

export const PAYMENT_STATUS_LABELS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  paid: "مدفوع",
  failed: "فشل",
  refunded: "مسترد",
};

export const PURCHASE_STATUS_LABELS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  received: "تم الاستلام",
  cancelled: "ملغي",
};

export const ORDER_SOURCE_LABELS_AR: Record<string, string> = {
  website: "الموقع",
  social: "سوشيال ميديا",
};
