"use client";

import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import { RoleToggle } from "@/components/admin/role-toggle";
import type { AdminUser } from "@/lib/admin/users";

export function UsersTable({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  const router = useRouter();

  if (users.length === 0) {
    return <EmptyState title="لم يتم العثور على مستخدمين." description="جرّب تغيير عوامل التصفية أو البحث." />;
  }

  return (
    <AdminTable headers={["الاسم", "البريد الإلكتروني", "الهاتف", "الدور", "تاريخ الإنشاء", ""]}>
      {users.map((user) => {
        // Only admin/super_admin accounts have an activity log worth
        // opening — a customer row stays inert.
        const isStaff = user.role === "admin" || user.role === "super_admin";

        return (
          <tr
            key={user.id}
            onClick={isStaff ? () => router.push(`/admin/users/${user.id}`) : undefined}
            className={`transition hover:bg-[#faf6f3] ${isStaff ? "cursor-pointer" : ""}`}
          >
            <td className="px-4 py-3 font-medium text-[#221d1b]">{user.full_name || "—"}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{user.email || "—"}</td>
            <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{user.phone_1 || "—"}</td>
            <td className="whitespace-nowrap px-4 py-3" onClick={(event) => event.stopPropagation()}>
              <RoleToggle userId={user.id} role={user.role} isSelf={user.id === currentUserId} />
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{new Date(user.created_at).toLocaleDateString("ar-EG")}</td>
            <td className="whitespace-nowrap px-4 py-3 text-left">
              {isStaff ? <span className="text-[0.68rem] font-medium text-[#4a4442]">← سجلّ النشاط</span> : null}
            </td>
          </tr>
        );
      })}
    </AdminTable>
  );
}
