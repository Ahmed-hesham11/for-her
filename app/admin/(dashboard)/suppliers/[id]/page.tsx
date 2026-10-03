import { notFound } from "next/navigation";
import { ErrorState } from "@/components/admin/empty-state";
import { SupplierForm } from "@/components/admin/supplier-form";
import { getAdminSupplierById } from "@/lib/admin/suppliers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseAdmin;

  if (!supabase) {
    return <ErrorState message="لم يتم إعداد Supabase." />;
  }

  const supplier = await getAdminSupplierById(supabase, id);
  if (!supplier) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">التوريد</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">{supplier.name}</h1>
      </div>

      <SupplierForm
        supplierId={supplier.id}
        initialSupplier={{
          name: supplier.name,
          phone: supplier.phone ?? "",
          email: supplier.email ?? "",
          address: supplier.address ?? "",
          notes: supplier.notes ?? "",
          is_active: supplier.is_active,
        }}
      />
    </div>
  );
}
