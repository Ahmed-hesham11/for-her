export default function OrderDetailLoading() {
  return (
    <div className="min-h-screen bg-[#f8f2ee]">
      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-10 md:px-8 md:pt-14">
        <div className="h-4 w-32 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mt-3 h-10 w-56 animate-pulse rounded-full bg-[#eadfd8]" />
        <div className="mt-10 h-64 animate-pulse rounded-[20px] bg-[#eadfd8]" />
        <div className="mt-6 h-40 animate-pulse rounded-[20px] bg-[#eadfd8]" />
      </main>
    </div>
  );
}
