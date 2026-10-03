import Link from "next/link";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function hrefForPage(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-between border-t border-[#eadfd7] px-4 py-3 text-sm text-[#5a504d]">
      <span>
        صفحة {page} من {totalPages} · {total} منتج
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefForPage(page - 1)} className="rounded-full border border-[#e4d4cd] px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.1em] transition hover:bg-[#f2e7df]">
            السابق
          </Link>
        ) : (
          <span className="rounded-full border border-[#eee1da] px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.1em] text-[#c9bcb6]">السابق</span>
        )}
        {page < totalPages ? (
          <Link href={hrefForPage(page + 1)} className="rounded-full border border-[#e4d4cd] px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.1em] transition hover:bg-[#f2e7df]">
            التالي
          </Link>
        ) : (
          <span className="rounded-full border border-[#eee1da] px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.1em] text-[#c9bcb6]">التالي</span>
        )}
      </div>
    </div>
  );
}
