"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setActiveAction } from "@/lib/admin/actions";

export function ActiveToggle({ table, id, isActive }: { table: string; id: string; isActive: boolean }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isSaving) return;

    setIsSaving(true);
    const { error } = await setActiveAction(table, id, !isActive);
    setIsSaving(false);

    if (!error) router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isSaving}
      className={`inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-medium transition disabled:opacity-60 ${
        isActive ? "bg-[#dcefe1] text-[#296b45] hover:bg-[#cbe6d5]" : "bg-[#f2e7df] text-[#4a4442] hover:bg-[#e9dccf]"
      }`}
    >
      {isSaving ? "..." : isActive ? "نشط" : "غير نشط"}
    </button>
  );
}
