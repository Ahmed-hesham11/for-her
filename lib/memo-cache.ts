// Tiny in-process TTL cache with stale-while-revalidate. The app runs as one
// long-lived Node process, so this keeps hot Supabase reads (catalog,
// categories) from being re-fetched on every request — which is what drove
// Supabase egress over quota. Unlike Next's data cache it has no 2MB entry
// limit. Admin writes call clearMemoCache() so edits show up immediately.
//
// The store lives on globalThis so every route bundle (and dev HMR reload)
// shares ONE cache instead of each holding its own copy and re-fetching the
// whole catalog independently. Once an entry has expired, the stale value is
// still served instantly while a single background refresh runs, so a burst of
// visitors (or a crawler) can never trigger a stampede of full-catalog queries.

type Entry = { value: Promise<unknown>; expires: number; refreshing: boolean };

const globalStore = globalThis as unknown as { __forHerMemo?: Map<string, Entry> };
const store = (globalStore.__forHerMemo ??= new Map<string, Entry>());
const MAX_ENTRIES = 500; // keys include search/page/product ids, so bound the memory
const EMPTY_TTL_MS = 10_000;

function load<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const value: Promise<T> = loader().then(
    (result) => {
      // Don't keep empty results (usually a transient Supabase error) for long.
      const empty = Array.isArray(result) && result.length === 0;
      const entry = store.get(key);
      if (entry && entry.value === value) {
        entry.expires = Date.now() + (empty ? EMPTY_TTL_MS : ttlMs);
        entry.refreshing = false;
      }
      return result;
    },
    (error) => {
      const entry = store.get(key);
      if (entry && entry.value === value) store.delete(key);
      throw error;
    },
  );
  return value;
}

export function memo<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);

  if (hit && hit.expires > now) return hit.value as Promise<T>;

  // Expired but still have a value: serve it now, refresh once in the background.
  if (hit && !hit.refreshing) {
    hit.refreshing = true;
    const stale = hit.value as Promise<T>;
    loader().then(
      (fresh) => {
        const empty = Array.isArray(fresh) && fresh.length === 0;
        const entry = store.get(key);
        if (entry === hit) {
          entry.value = Promise.resolve(fresh);
          entry.expires = Date.now() + (empty ? EMPTY_TTL_MS : ttlMs);
          entry.refreshing = false;
        }
      },
      () => {
        // Keep serving the stale value; retry shortly.
        if (store.get(key) === hit) { hit.refreshing = false; hit.expires = Date.now() + EMPTY_TTL_MS; }
      },
    );
    return stale;
  }
  if (hit) return hit.value as Promise<T>;

  if (store.size >= MAX_ENTRIES) {
    for (const [k, e] of store) if (e.expires <= now) store.delete(k);
    if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
  }

  const value = load(key, ttlMs, loader);
  store.set(key, { value, expires: now + ttlMs, refreshing: false });
  return value;
}

export function clearMemoCache() {
  store.clear();
}
