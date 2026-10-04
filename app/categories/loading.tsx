export default function CategoriesLoading() {
  return (
    <div className="min-h-screen bg-[#f8f2ee]">
      <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-10 md:px-8 md:pt-14">
        <div className="h-4 w-32 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mt-3 h-14 w-80 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-[4/5] animate-pulse rounded-[20px] bg-[#eadfd8]" />
          ))}
        </div>
      </main>
    </div>
  );
}
