export default function OrdersLoading() {
  return (
    <div className="min-h-screen bg-[#f8f2ee]">
      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-10 md:px-8 md:pt-14">
        <div className="h-4 w-32 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mt-3 h-10 w-56 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mt-10 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[20px] bg-[#eadfd8]" />
          ))}
        </div>
      </main>
    </div>
  );
}
