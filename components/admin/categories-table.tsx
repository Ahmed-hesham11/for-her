"use client";

import { useRouter } from "next/navigation";
import { ActiveToggle } from "@/components/admin/active-toggle";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import type { AdminCategory } from "@/lib/admin/categories";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80";

export function CategoriesTable({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();

  if (categories.length === 0) {
    return <EmptyState title="لم يتم العثور على فئات." description="أضف فئة لبدء تنظيم الكتالوج." />;
  }

  return (
    <AdminTable headers={["الصورة", "الاسم", "الفئة الأم", "المنتجات", "الحالة", ""]}>
      {categories.map((category) => (
        <tr key={category.id} onClick={() => router.push(`/admin/categories/${category.id}`)} className="cursor-pointer transition hover:bg-[#faf6f3]">
          <td className="px-4 py-3">
            <div className="h-12 w-12 overflow-hidden rounded-[10px] bg-[#f1e7e0]">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-entered URLs can be from any host, not just the allow-listed images.unsplash.com */}
              <img src={category.image_url || FALLBACK_IMAGE} alt={category.name} className="h-full w-full object-cover" />
            </div>
          </td>
          <td className="px-4 py-3 font-medium text-[#221d1b]">{category.name}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{category.parent_name ?? "—"}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{category.product_count}</td>
          <td className="whitespace-nowrap px-4 py-3" onClick={(event) => event.stopPropagation()}>
            <ActiveToggle table="categories" id={category.id} isActive={category.is_active} />
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-left">
            <span className="text-[0.68rem] font-medium text-[#4a4442]">← تعديل</span>
          </td>
        </tr>
      ))}
    </AdminTable>
  );
}
