"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setUserRoleAction } from "@/lib/admin/actions";
import type { AdminUserRole } from "@/lib/admin/users";

const ROLE_LABELS_AR: Record<AdminUserRole, string> = {
  customer: "عميل",
  admin: "أدمن",
  super_admin: "سوبر أدمن",
};

export function RoleToggle({ userId, role, isSelf }: { userId: string; role: AdminUserRole; isSelf: boolean }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // super_admin is never editable here — promotion/demotion of a super_admin
  // stays a manual Supabase operation (see the migration's comment).
  if (role === "super_admin") {
    return <span className="inline-flex items-center rounded-full bg-[#f6e6c8] px-3 py-1 text-[0.7rem] font-medium text-[#7a5b1e]">{ROLE_LABELS_AR.super_admin}</span>;
  }

  // A super_admin can't change their own role from here — avoids locking
  // themselves out by accident. The server enforces this too.
  if (isSelf) {
    return <span className="inline-flex items-center rounded-full bg-[#dcefe1] px-3 py-1 text-[0.7rem] font-medium text-[#296b45]">{ROLE_LABELS_AR[role]} (أنت)</span>;
  }

  const nextRole: "customer" | "admin" = role === "admin" ? "customer" : "admin";

  const handleToggle = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isSaving) return;

    setIsSaving(true);
    setError("");
    const { error: actionError } = await setUserRoleAction(userId, nextRole);
    setIsSaving(false);

    if (actionError) setError(actionError);
    else router.refresh();
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isSaving}
        className={`inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-medium transition disabled:opacity-60 ${
          role === "admin" ? "bg-[#dcefe1] text-[#296b45] hover:bg-[#cbe6d5]" : "bg-[#f2e7df] text-[#4a4442] hover:bg-[#e9dccf]"
        }`}
        title={role === "admin" ? "اضغط لإزالة صلاحية الأدمن" : "اضغط لترقية إلى أدمن"}
      >
        {isSaving ? "..." : ROLE_LABELS_AR[role]}
      </button>
      {error ? <span className="text-[0.62rem] text-[#8a3f34]">{error}</span> : null}
    </div>
  );
}
