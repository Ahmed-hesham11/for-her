// PostgREST silently caps every response at 1000 rows, so an un-ranged
// `.select()` on a big table returns only the first 1000 with no error. This
// walks a query page by page until it has everything. `build` must return a
// query with a stable ORDER BY (add an `id` tiebreaker) so pages never overlap.
const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<PageResult<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}
