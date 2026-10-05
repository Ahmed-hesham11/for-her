import type { RevenueProfitDay } from "@/lib/admin/data";
import { formatEgp } from "@/lib/currency";

function formatDayLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RevenueChart({ data }: { data: RevenueProfitDay[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-[#8a7c78]">لا توجد بيانات إيرادات بعد.</p>;
  }

  const max = Math.max(...data.map((point) => Math.max(point.revenue, point.profit)), 1);
  const width = 100;
  const height = 40;
  const groupGap = 0.6;
  const groupWidth = width / data.length - groupGap;
  const barGap = groupWidth * 0.14;
  const barWidth = (groupWidth - barGap) / 2;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height + 6}`} preserveAspectRatio="none" className="h-48 w-full">
        {data.map((point, index) => {
          const revenueHeight = (point.revenue / max) * height;
          // A loss day (cost > revenue) would go negative — clamp to 0
          // rather than draw a bar growing the wrong way from the baseline.
          const profitHeight = (Math.max(point.profit, 0) / max) * height;
          const groupX = index * (groupWidth + groupGap);

          return (
            <g key={point.day}>
              <title>{`${formatDayLabel(point.day)} — الإيرادات ${formatEgp(point.revenue)}، الربح ${formatEgp(point.profit)}`}</title>
              <rect
                x={groupX}
                y={height - revenueHeight}
                width={barWidth}
                height={Math.max(revenueHeight, 0.6)}
                rx={0.6}
                className="fill-[#d6b07d] transition hover:fill-[#c39a63]"
              />
              <rect
                x={groupX + barWidth + barGap}
                y={height - profitHeight}
                width={barWidth}
                height={Math.max(profitHeight, 0.6)}
                rx={0.6}
                className="fill-[#8fae7c] transition hover:fill-[#79995f]"
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex items-center gap-4 text-[0.62rem] uppercase tracking-[0.08em] text-[#8a7c78]">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d6b07d]" />الإيرادات</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#8fae7c]" />الربح</span>
      </div>
      <div className="mt-2 flex justify-between text-[0.62rem] uppercase tracking-[0.08em] text-[#8a7c78]">
        <span>{formatDayLabel(data[0].day)}</span>
        <span>{formatDayLabel(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}
