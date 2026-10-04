export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-[#f8f2ee]">
      <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-10 md:px-8 md:pt-14">
        <div className="h-4 w-32 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mt-3 h-14 w-80 animate-pulse rounded-full bg-[#eadfd8]" />

        <div className="mt-10 flex flex-col gap-8 lg:mt-12 lg:flex-row lg:items-start lg:gap-10">
          <div className="hidden w-[220px] shrink-0 space-y-3 lg:block">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-6 animate-pulse rounded-full bg-[#eadfd8]" />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="aspect-[3/4] animate-pulse rounded-[20px] bg-[#eadfd8]" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
