"use server";

// Every admin write now goes through this file instead of the browser
// talking to Postgres directly with the anon key. Each action re-checks
// requireAdmin() itself (never trust that the calling page already did),
// then delegates to the existing lib/admin/*.ts query functions — those
// were already written to take a SupabaseClient as their first argument,
// so the only thing that changes is which client they're given: the
// service-role client, which bypasses RLS, instead of the browser's
// anon-key client that RLS used to gate via is_admin()/auth.uid().

import { requireAdmin, requireSuperAdmin } from "@/lib/admin/auth";
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
import { createProduct, updateProduct, setProductActive, type ProductInput } from "@/lib/admin/products";
import { createPurchase, type NewPurchaseItem } from "@/lib/admin/purchases";
import { updateShippingRates } from "@/lib/admin/shipping";
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

export async function setActiveAction(table: string, id: string, isActive: boolean) {
  await requireAdmin();
  if (!TOGGLEABLE_TABLES.has(table)) throw new Error("Invalid table.");
  const { error } = await requireClient().from(table).update({ is_active: isActive }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function setProductActiveAction(id: string, isActive: boolean) {
  await requireAdmin();
  return setProductActive(requireClient(), id, isActive);
}

export async function createProductAction(input: ProductInput) {
  await requireAdmin();
  return createProduct(requireClient(), input);
}

export async function updateProductAction(id: string, input: ProductInput) {
  await requireAdmin();
  return updateProduct(requireClient(), id, input);
}

export async function createCategoryAction(input: CategoryInput) {
  await requireAdmin();
  return createCategory(requireClient(), input);
}

export async function updateCategoryAction(id: string, input: CategoryInput) {
  await requireAdmin();
  return updateCategory(requireClient(), id, input);
}

export async function createCouponAction(input: CouponInput) {
  await requireAdmin();
  return createCoupon(requireClient(), input);
}

export async function updateCouponAction(id: string, input: CouponInput) {
  await requireAdmin();
  return updateCoupon(requireClient(), id, input);
}

export async function deleteCouponAction(id: string) {
  await requireAdmin();
  return deleteCoupon(requireClient(), id);
}

export async function createSupplierAction(input: SupplierInput) {
  await requireAdmin();
  return createSupplier(requireClient(), input);
}

export async function updateSupplierAction(id: string, input: SupplierInput) {
  await requireAdmin();
  return updateSupplier(requireClient(), id, input);
}

export async function createPurchaseAction(input: { supplier_id: string; purchase_date: string; notes: string; items: NewPurchaseItem[] }) {
  await requireAdmin();
  return createPurchase(requireClient(), input);
}

export async function updateShippingRatesAction(updates: { id: string; shipping_fee: number; is_active: boolean }[]) {
  await requireAdmin();
  return updateShippingRates(requireClient(), updates);
}

export async function updateOrderStatusAction(id: string, status: string) {
  await requireAdmin();
  return updateOrderStatus(requireClient(), id, status);
}

export async function updatePaymentStatusAction(id: string, paymentStatus: string) {
  await requireAdmin();
  return updatePaymentStatus(requireClient(), id, paymentStatus);
}

export async function updateOrderConfirmedAction(id: string, confirmed: boolean) {
  await requireAdmin();
  return updateOrderConfirmed(requireClient(), id, confirmed);
}

export async function updateOrderPrintedAction(id: string, printed: boolean) {
  await requireAdmin();
  return updateOrderPrinted(requireClient(), id, printed);
}

export async function createManualOrderAction(input: ManualOrderInput) {
  await requireAdmin();
  return createManualOrder(requireClient(), input);
}

export async function setUserRoleAction(targetId: string, newRole: "customer" | "admin") {
  const { profile } = await requireSuperAdmin();
  return setUserRole(requireClient(), profile.id, targetId, newRole);
}

const IMAGE_BUCKET = "catalog-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadCatalogImageAction(file: File, folder: string): Promise<{ url: string | null; error: string | null }> {
  await requireAdmin();
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
  return { url: data.publicUrl, error: null };
}
