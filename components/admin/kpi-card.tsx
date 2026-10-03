export function KpiCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon?: React.ReactElement;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClasses = {
    default: "bg-[#f2e7df] text-[#4a4442]",
    warning: "bg-[#f6e6c8] text-[#7a5b1e]",
    danger: "bg-[#f6dcd6] text-[#8a3f34]",
  }[tone];

  return (
    <div className="rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-5 shadow-[0_10px_24px_rgba(45,29,23,0.03)]">
      <div className="flex items-center justify-between">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[#8a7c78]">{label}</p>
        {icon ? <span className={`flex h-8 w-8 items-center justify-center rounded-full ${toneClasses}`}>{icon}</span> : null}
      </div>
      <p className="mt-3 text-[1.9rem] font-semibold leading-none text-[#1d1918]">{value}</p>
    </div>
  );
}
