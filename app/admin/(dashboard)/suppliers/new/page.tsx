import { SupplierForm } from "@/components/admin/supplier-form";

export default function NewSupplierPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a7c78]">التوريد</p>
        <h1 className="brand-serif text-[2.6rem] leading-none text-[#1d1918]">إضافة مورد</h1>
      </div>

      <SupplierForm />
    </div>
  );
}
