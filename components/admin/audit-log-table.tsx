import { AdminTable } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/admin/empty-state";
import { AUDIT_ENTITY_LABELS_AR, type AuditLogEntry } from "@/lib/admin/audit";
import { formatDateTime } from "@/lib/format-date";

export function AuditLogTable({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState title="لا يوجد نشاط مسجّل." description="سيظهر هنا كل ما يعدّله أو يحفظه أو يرفعه هذا الحساب من الآن فصاعدًا." />;
  }

  return (
    <AdminTable headers={["الوقت", "النوع", "الإجراء"]}>
      {entries.map((entry) => (
        <tr key={entry.id}>
          <td className="whitespace-nowrap px-4 py-3 text-[#8a7c78]">
            {formatDateTime(entry.created_at)}
          </td>
          <td className="whitespace-nowrap px-4 py-3">
            <span className="inline-flex items-center rounded-full bg-[#f2e7df] px-3 py-1 text-[0.7rem] font-medium text-[#4a4442]">
              {AUDIT_ENTITY_LABELS_AR[entry.entity_type] ?? entry.entity_type}
            </span>
          </td>
          <td className="px-4 py-3 text-[#221d1b]">{entry.summary}</td>
        </tr>
      ))}
    </AdminTable>
  );
}
