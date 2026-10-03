export function DashboardSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[#eadfd7] bg-[#fbf8f5] p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[0.8rem] font-medium uppercase tracking-[0.14em] text-[#5a504d]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
