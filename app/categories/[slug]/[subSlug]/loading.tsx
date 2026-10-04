export default function SubcategoryLoading() {
  return (
    <div className="min-h-screen bg-[#f8f2ee]">
      <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-10 md:px-8 md:pt-14">
        <div className="h-4 w-48 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mt-3 h-14 w-80 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="aspect-[3/4] animate-pulse rounded-[20px] bg-[#eadfd8]" />
          ))}
        </div>
      </main>
    </div>
  );
}
