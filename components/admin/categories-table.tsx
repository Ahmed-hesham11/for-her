"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActiveToggle } from "@/components/admin/active-toggle";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import { reorderCategoriesAction } from "@/lib/admin/actions";
import type { AdminCategory } from "@/lib/admin/categories";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80";

// Top-level categories in order, each followed by its own subcategories —
// the same grouping the order is saved in (one sort_order list per parent).
function groupByParent(categories: AdminCategory[]) {
  const topLevel = categories.filter((category) => !category.parent_id);
  const topLevelIds = new Set(topLevel.map((category) => category.id));
  return topLevel.flatMap((parent) => [parent, ...categories.filter((category) => category.parent_id === parent.id)])
    .concat(categories.filter((category) => category.parent_id && !topLevelIds.has(category.parent_id)));
}

export function CategoriesTable({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(() => groupByParent(categories));
  const [lastServerCategories, setLastServerCategories] = useState(categories);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Pick up fresh server data (after router.refresh(), an edit elsewhere...).
  if (categories !== lastServerCategories) {
    setLastServerCategories(categories);
    setRows(groupByParent(categories));
  }

  if (rows.length === 0) {
    return <EmptyState title="لم يتم العثور على فئات." description="أضف فئة لبدء تنظيم الكتالوج." />;
  }

  const dragged = dragId ? rows.find((row) => row.id === dragId) : null;
  // Only rows of the same group (same parent) can swap places.
  const canDropOn = (target: AdminCategory) => Boolean(dragged) && dragged!.id !== target.id && dragged!.parent_id === target.parent_id;

  const handleDrop = async (target: AdminCategory) => {
    setOverId(null);
    setDragId(null);
    if (!dragged || !canDropOn(target)) return;

    const previous = rows;
    const group = rows.filter((row) => row.parent_id === dragged.parent_id);
    const reordered = group.filter((row) => row.id !== dragged.id);
    const targetIndex = reordered.findIndex((row) => row.id === target.id);
    const fromIndex = group.findIndex((row) => row.id === dragged.id);
    const toIndex = fromIndex < group.findIndex((row) => row.id === target.id) ? targetIndex + 1 : targetIndex;
    reordered.splice(toIndex, 0, dragged);

    setRows(groupByParent([...reordered, ...rows.filter((row) => row.parent_id !== dragged.parent_id)]));
    setError("");

    try {
      const { error: saveError } = await reorderCategoriesAction(reordered.map((row) => row.id));
      if (saveError) throw new Error(saveError);
      router.refresh();
    } catch (saveFailure) {
      setRows(previous);
      setError(saveFailure instanceof Error ? saveFailure.message : "تعذّر حفظ الترتيب الآن.");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#8a7c78]">اسحب الفئة من المقبض ⋮⋮ وأفلتها في مكانها الجديد. الترتيب بيتطبق في الموقع، والفئات الفرعية بتتحرك داخل الفئة الأم بس.</p>
      {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}

      <AdminTable headers={["", "الصورة", "الاسم", "الفئة الأم", "المنتجات", "الحالة", ""]}>
        {rows.map((category) => (
          <tr
            key={category.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              setDragId(category.id);
            }}
            onDragOver={(event) => {
              if (!canDropOn(category)) return;
              event.preventDefault();
              setOverId(category.id);
            }}
            onDragLeave={() => setOverId((current) => (current === category.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              void handleDrop(category);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onClick={() => router.push(`/admin/categories/${category.id}`)}
            className={`cursor-pointer transition hover:bg-[#faf6f3] ${dragId === category.id ? "opacity-40" : ""} ${overId === category.id ? "bg-[#f6e9e2] shadow-[inset_0_2px_0_#a06f5c]" : ""}`}
          >
            <td className="w-8 select-none px-3 py-3 text-lg leading-none text-[#b3a29b]" title="اسحب لإعادة الترتيب" aria-hidden="true">⋮⋮</td>
            <td className="px-4 py-3">
              <div className="h-12 w-12 overflow-hidden rounded-[10px] bg-[#f1e7e0]">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-entered URLs can be from any host, not just the allow-listed images.unsplash.com */}
                <img src={category.image_url || FALLBACK_IMAGE} alt={category.name} draggable={false} className="h-full w-full object-cover" />
              </div>
            </td>
            <td className={`px-4 py-3 font-medium text-[#221d1b] ${category.parent_id ? "pe-8" : ""}`}>
              {category.parent_id ? <span className="me-2 text-[#b3a29b]">↳</span> : null}
              {category.name}
              {!category.parent_id && !category.show_on_home ? <span className="ms-2 rounded-full bg-[#f1e7e0] px-2 py-0.5 text-[0.62rem] font-medium text-[#8a7c78]">مخفية من الرئيسية</span> : null}
            </td>
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
    </div>
  );
}
