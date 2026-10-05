"use client";

import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import { RoleToggle } from "@/components/admin/role-toggle";
import type { AdminUser } from "@/lib/admin/users";

export function UsersTable({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  if (users.length === 0) {
    return <EmptyState title="لم يتم العثور على مستخدمين." description="جرّب تغيير عوامل التصفية أو البحث." />;
  }

  return (
    <AdminTable headers={["الاسم", "البريد الإلكتروني", "الهاتف", "الدور", "تاريخ الإنشاء"]}>
      {users.map((user) => (
        <tr key={user.id} className="transition hover:bg-[#faf6f3]">
          <td className="px-4 py-3 font-medium text-[#221d1b]">{user.full_name || "—"}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{user.email || "—"}</td>
          <td className="whitespace-nowrap px-4 py-3 text-[#4a4442]">{user.phone_1 || "—"}</td>
          <td className="whitespace-nowrap px-4 py-3">
            <RoleToggle userId={user.id} role={user.role} isSelf={user.id === currentUserId} />
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">{new Date(user.created_at).toLocaleDateString("ar-EG")}</td>
        </tr>
      ))}
    </AdminTable>
  );
}
