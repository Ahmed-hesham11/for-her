// Tiny in-process TTL cache. The app runs as one long-lived Node process, so
// this keeps hot Supabase reads (catalog, categories) from being re-fetched on
// every request — which is what drove Supabase egress over quota. Unlike
// Next's data cache it has no 2MB entry limit. Admin writes call
// clearMemoCache() so edits show up immediately.

type Entry = { value: Promise<unknown>; expires: number };

const store = new Map<string, Entry>();

export function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;

  const value = load().then(
    (result) => {
      // Don't keep empty results (usually a transient Supabase error) for long.
      const empty = Array.isArray(result) && result.length === 0;
      const entry = store.get(key);
      if (entry && entry.value === value) entry.expires = Date.now() + (empty ? 10_000 : ttlMs);
      return result;
    },
    (error) => {
      store.delete(key);
      throw error;
    },
  );
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

export function clearMemoCache() {
  store.clear();
}
