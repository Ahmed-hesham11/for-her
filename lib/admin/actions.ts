"use server";

// Every admin write now goes through this file instead of the browser
// talking to Postgres directly with the anon key. Each action re-checks
// requireAdmin() itself (never trust that the calling page already did),
// then delegates to the existing lib/admin/*.ts query functions — those
// were already written to take a SupabaseClient as their first argument,
// so the only thing that changes is which client they're given: the
// service-role client, which bypasses RLS, instead of the browser's
// anon-key client that RLS used to gate via is_admin()/auth.uid().
//
// Every action also writes one row to admin_audit_log (via logAdminAction)
// right after its write succeeds — this is the single place every admin
// mutation passes through, so it's also the single place to log from. A
// failed write is never logged; a few actions that only have an id to work
// with (e.g. toggling a product by id) fetch a display name first so the
// log reads as a sentence instead of a bare uuid.

import { requireAdmin, requireSuperAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createCategory, updateCategory, type CategoryInput } from "@/lib/admin/categories";
import { createCoupon, updateCoupon, deleteCoupon, type CouponInput } from "@/lib/admin/coupons";
import {
  createManualOrder,
  updateOrderConfirmed,
  updateOrderPrinted,
  updateOrderStatus,
  updatePaymentStatus,
  type ManualOrderInput,
} from "@/lib/admin/orders";
import { createProduct, updateProduct, setProductActive, setProductStock, type ProductInput } from "@/lib/admin/products";
import { createPurchase, type NewPurchaseItem } from "@/lib/admin/purchases";
import { updateShippingRates } from "@/lib/admin/shipping";
import { ORDER_STATUS_LABELS_AR, PAYMENT_STATUS_LABELS_AR } from "@/lib/admin/status-labels-ar";
import { createSupplier, updateSupplier, type SupplierInput } from "@/lib/admin/suppliers";
import { setUserRole } from "@/lib/admin/users";
import { supabaseAdmin } from "@/lib/supabase/admin";

function requireClient() {
  if (!supabaseAdmin) throw new Error("Server is not configured.");
  return supabaseAdmin;
}

// Tables the generic ActiveToggle is allowed to touch — an explicit
// allowlist rather than trusting whatever string a caller passes in.
const TOGGLEABLE_TABLES = new Set(["categories", "suppliers"]);
const TOGGLEABLE_TABLE_LABELS_AR: Record<string, string> = { categories: "الفئة", suppliers: "المورد" };
const TOGGLEABLE_TABLE_ENTITY_TYPE: Record<string, string> = { categories: "category", suppliers: "supplier" };

export async function setActiveAction(table: string, id: string, isActive: boolean) {
  const { profile } = await requireAdmin();
  if (!TOGGLEABLE_TABLES.has(table)) throw new Error("Invalid table.");

  const client = requireClient();
  const { data: row } = await client.from(table).select("name").eq("id", id).maybeSingle();
  const { error } = await client.from(table).update({ is_active: isActive }).eq("id", id);

  if (!error) {
    const name = (row as { name?: string } | null)?.name ?? id;
    await logAdminAction(client, profile, {
      action: isActive ? "activate" : "deactivate",
      entity_type: TOGGLEABLE_TABLE_ENTITY_TYPE[table],
      entity_id: id,
      summary: `${isActive ? "فعّل" : "عطّل"} ${TOGGLEABLE_TABLE_LABELS_AR[table]} "${name}"`,
    });
  }

  return { error: error?.message ?? null };
}

export async function setProductActiveAction(id: string, isActive: boolean) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const { data: row } = await client.from("products").select("name").eq("id", id).maybeSingle();
  const result = await setProductActive(client, id, isActive);

  if (!result.error) {
    await logAdminAction(client, profile, {
      action: isActive ? "activate" : "deactivate",
      entity_type: "product",
      entity_id: id,
      summary: `${isActive ? "فعّل" : "عطّل"} المنتج "${(row as { name?: string } | null)?.name ?? id}"`,
    });
  }

  return result;
}

export async function setProductStockAction(id: string, quantity: number) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const { data: row } = await client.from("products").select("name").eq("id", id).maybeSingle();
  const result = await setProductStock(client, id, quantity);

  if (!result.error) {
    await logAdminAction(client, profile, {
      action: "adjust_stock",
      entity_type: "product",
      entity_id: id,
      summary: `عدّل مخزون المنتج "${(row as { name?: string } | null)?.name ?? id}" إلى ${quantity}`,
    });
  }

  return result;
}

export async function createProductAction(input: ProductInput) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await createProduct(client, input);

  if (!result.error && result.id) {
    await logAdminAction(client, profile, {
      action: "create",
      entity_type: "product",
      entity_id: result.id,
      summary: `أضاف منتج جديد "${input.name}"`,
    });
  }

  return result;
}

export async function updateProductAction(id: string, input: ProductInput) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await updateProduct(client, id, input);

  if (!result.error) {
    await logAdminAction(client, profile, {
      action: "update",
      entity_type: "product",
      entity_id: id,
      summary: `عدّل المنتج "${input.name}"`,
    });
  }

  return result;
}

export async function createCategoryAction(input: CategoryInput) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await createCategory(client, input);

  if (!result.error && result.id) {
    await logAdminAction(client, profile, {
      action: "create",
      entity_type: "category",
      entity_id: result.id,
      summary: `أضاف فئة جديدة "${input.name}"`,
    });
  }

  return result;
}

export async function updateCategoryAction(id: string, input: CategoryInput) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await updateCategory(client, id, input);

  if (!result.error) {
    await logAdminAction(client, profile, {
      action: "update",
      entity_type: "category",
      entity_id: id,
      summary: `عدّل الفئة "${input.name}"`,
    });
  }

  return result;
}

export async function createCouponAction(input: CouponInput) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await createCoupon(client, input);

  if (!result.error && result.id) {
    await logAdminAction(client, profile, {
      action: "create",
      entity_type: "coupon",
      entity_id: result.id,
      summary: `أضاف كوبون جديد "${input.code}"`,
    });
  }

  return result;
}

export async function updateCouponAction(id: string, input: CouponInput) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await updateCoupon(client, id, input);

  if (!result.error) {
    await logAdminAction(client, profile, {
      action: "update",
      entity_type: "coupon",
      entity_id: id,
      summary: `عدّل الكوبون "${input.code}"`,
    });
  }

  return result;
}

export async function deleteCouponAction(id: string) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const { data: row } = await client.from("coupons").select("code").eq("id", id).maybeSingle();
  const result = await deleteCoupon(client, id);

  if (!result.error) {
    await logAdminAction(client, profile, {
      action: "delete",
      entity_type: "coupon",
      entity_id: id,
      summary: `حذف الكوبون "${(row as { code?: string } | null)?.code ?? id}"`,
    });
  }

  return result;
}

export async function createSupplierAction(input: SupplierInput) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await createSupplier(client, input);

  if (!result.error && result.id) {
    await logAdminAction(client, profile, {
      action: "create",
      entity_type: "supplier",
      entity_id: result.id,
      summary: `أضاف مورد جديد "${input.name}"`,
    });
  }

  return result;
}

export async function updateSupplierAction(id: string, input: SupplierInput) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await updateSupplier(client, id, input);

  if (!result.error) {
    await logAdminAction(client, profile, {
      action: "update",
      entity_type: "supplier",
      entity_id: id,
      summary: `عدّل المورد "${input.name}"`,
    });
  }

  return result;
}

export async function createPurchaseAction(input: { supplier_id: string; purchase_date: string; notes: string; items: NewPurchaseItem[] }) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await createPurchase(client, input);

  if (!result.error && result.id) {
    const { data: supplier } = await client.from("suppliers").select("name").eq("id", input.supplier_id).maybeSingle();
    await logAdminAction(client, profile, {
      action: "create",
      entity_type: "purchase",
      entity_id: result.id,
      summary: `سجّل عملية شراء من "${(supplier as { name?: string } | null)?.name ?? input.supplier_id}" بعدد ${input.items.length} صنف`,
    });
  }

  return result;
}

export async function updateShippingRatesAction(updates: { id: string; shipping_fee: number; is_active: boolean }[]) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await updateShippingRates(client, updates);

  if (!result.error) {
    await logAdminAction(client, profile, {
      action: "update",
      entity_type: "shipping_rate",
      entity_id: null,
      summary: `حدّث أسعار الشحن (${updates.length} محافظة)`,
    });
  }

  return result;
}

export async function updateOrderStatusAction(id: string, status: string) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const { data: row } = await client.from("orders").select("order_number").eq("id", id).maybeSingle();
  const result = await updateOrderStatus(client, id, status);

  if (!result.error) {
    const orderLabel = (row as { order_number?: number } | null)?.order_number ?? id;
    await logAdminAction(client, profile, {
      action: "update_status",
      entity_type: "order",
      entity_id: id,
      summary: `غيّر حالة الطلب رقم ${orderLabel} إلى "${ORDER_STATUS_LABELS_AR[status] ?? status}"`,
    });
  }

  return result;
}

export async function updatePaymentStatusAction(id: string, paymentStatus: string) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const { data: row } = await client.from("orders").select("order_number").eq("id", id).maybeSingle();
  const result = await updatePaymentStatus(client, id, paymentStatus);

  if (!result.error) {
    const orderLabel = (row as { order_number?: number } | null)?.order_number ?? id;
    await logAdminAction(client, profile, {
      action: "update_payment_status",
      entity_type: "order",
      entity_id: id,
      summary: `غيّر حالة الدفع للطلب رقم ${orderLabel} إلى "${PAYMENT_STATUS_LABELS_AR[paymentStatus] ?? paymentStatus}"`,
    });
  }

  return result;
}

export async function updateOrderConfirmedAction(id: string, confirmed: boolean) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const { data: row } = await client.from("orders").select("order_number").eq("id", id).maybeSingle();
  const result = await updateOrderConfirmed(client, id, confirmed);

  if (!result.error) {
    const orderLabel = (row as { order_number?: number } | null)?.order_number ?? id;
    await logAdminAction(client, profile, {
      action: "update",
      entity_type: "order",
      entity_id: id,
      summary: `${confirmed ? "أكّد" : "ألغى تأكيد"} الطلب رقم ${orderLabel}`,
    });
  }

  return result;
}

export async function updateOrderPrintedAction(id: string, printed: boolean) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const { data: row } = await client.from("orders").select("order_number").eq("id", id).maybeSingle();
  const result = await updateOrderPrinted(client, id, printed);

  if (!result.error) {
    const orderLabel = (row as { order_number?: number } | null)?.order_number ?? id;
    await logAdminAction(client, profile, {
      action: "update",
      entity_type: "order",
      entity_id: id,
      summary: `${printed ? "وضع علامة مطبوع على" : "ألغى علامة مطبوع عن"} الطلب رقم ${orderLabel}`,
    });
  }

  return result;
}

export async function createManualOrderAction(input: ManualOrderInput) {
  const { profile } = await requireAdmin();
  const client = requireClient();
  const result = await createManualOrder(client, input);

  if (!result.error && result.id) {
    await logAdminAction(client, profile, {
      action: "create",
      entity_type: "order",
      entity_id: result.id,
      summary: `أنشأ طلبًا يدويًا للعميل "${input.customer_name}"`,
    });
  }

  return result;
}

export async function setUserRoleAction(targetId: string, newRole: "customer" | "admin") {
  const { profile } = await requireSuperAdmin();
  const client = requireClient();
  const { data: target } = await client.from("profiles").select("full_name").eq("id", targetId).maybeSingle();
  const result = await setUserRole(client, profile.id, targetId, newRole);

  if (!result.error) {
    await logAdminAction(client, profile, {
      action: "set_role",
      entity_type: "user",
      entity_id: targetId,
      summary: `غيّر دور "${(target as { full_name?: string } | null)?.full_name ?? targetId}" إلى ${newRole === "admin" ? "أدمن" : "عميل"}`,
    });
  }

  return result;
}

const IMAGE_BUCKET = "catalog-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadCatalogImageAction(file: File, folder: string): Promise<{ url: string | null; error: string | null }> {
  const { profile } = await requireAdmin();
  if (!file.type.startsWith("image/")) return { url: null, error: "Please choose an image file." };
  if (file.size > MAX_IMAGE_BYTES) return { url: null, error: "Image must be 5MB or smaller." };

  const client = requireClient();
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await client.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) return { url: null, error: uploadError.message };

  const { data } = client.storage.from(IMAGE_BUCKET).getPublicUrl(path);

  await logAdminAction(client, profile, {
    action: "upload",
    entity_type: "image",
    entity_id: null,
    summary: `رفع صورة "${file.name}" إلى "${folder}"`,
  });

  return { url: data.publicUrl, error: null };
}
