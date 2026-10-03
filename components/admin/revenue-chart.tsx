import type { RevenueByDay } from "@/lib/admin/data";
import { formatEgp } from "@/lib/currency";

function formatDayLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RevenueChart({ data }: { data: RevenueByDay[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-[#8a7c78]">لا توجد بيانات إيرادات بعد.</p>;
  }

  const max = Math.max(...data.map((point) => point.revenue), 1);
  const width = 100;
  const height = 40;
  const barGap = 0.6;
  const barWidth = width / data.length - barGap;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height + 6}`} preserveAspectRatio="none" className="h-48 w-full">
        {data.map((point, index) => {
          const barHeight = (point.revenue / max) * height;
          const x = index * (barWidth + barGap);
          const y = height - barHeight;

          return (
            <g key={point.day}>
              <title>{`${formatDayLabel(point.day)}: ${formatEgp(point.revenue)}`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 0.6)}
                rx={0.8}
                className="fill-[#d6b07d] transition hover:fill-[#c39a63]"
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[0.62rem] uppercase tracking-[0.08em] text-[#8a7c78]">
        <span>{formatDayLabel(data[0].day)}</span>
        <span>{formatDayLabel(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}
