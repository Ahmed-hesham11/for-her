export default function CartLoading() {
  return (
    <div className="min-h-screen bg-[#f8f2ee]">
      <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
        <div className="mx-auto h-4 w-32 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mx-auto mt-3 h-10 w-56 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_0.7fr]">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-[24px] bg-[#eadfd8]" />
            ))}
          </div>
          <div className="h-56 animate-pulse rounded-[24px] bg-[#eadfd8]" />
        </div>
      </main>
    </div>
  );
}
