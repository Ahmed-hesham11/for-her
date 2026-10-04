export default function ProductDetailLoading() {
  return (
    <div className="min-h-screen bg-[#f8f2ee]">
      <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-10 md:px-8 md:pt-14">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-[24px] bg-[#eadfd8]" />
          <div className="space-y-4">
            <div className="h-4 w-32 animate-pulse rounded-full bg-[#eadfd8]" />
            <div className="h-10 w-3/4 animate-pulse rounded-full bg-[#eadfd8]" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-[#eadfd8]" />
            <div className="h-24 animate-pulse rounded-[20px] bg-[#eadfd8]" />
            <div className="h-12 w-48 animate-pulse rounded-full bg-[#eadfd8]" />
          </div>
        </div>
      </main>
    </div>
  );
}
