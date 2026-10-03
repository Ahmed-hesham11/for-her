import { StatusBadge } from "@/components/admin/status-badge";
import type { OrderStatusCount } from "@/lib/admin/data";

export function OrderStatusSummary({ counts }: { counts: OrderStatusCount[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {counts.map((item) => (
        <div key={item.status} className="rounded-[16px] border border-[#eadfd7] bg-[#fbf8f5] p-4 text-center">
          <p className="text-2xl font-semibold text-[#1d1918]">{item.count}</p>
          <div className="mt-2 flex justify-center">
            <StatusBadge status={item.status} kind="order" />
          </div>
        </div>
      ))}
    </div>
  );
}
