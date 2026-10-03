export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 animate-pulse rounded-full bg-[#eadfd7]" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[20px] bg-[#eadfd7]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[20px] bg-[#eadfd7]" />
      <div className="h-64 animate-pulse rounded-[20px] bg-[#eadfd7]" />
    </div>
  );
}
