// Per-isolate TTL cache for read-only analytics (60 s). One typed cache per view; no serialization.
export type TtlCache<T> = (key: string, load: () => Promise<T>) => Promise<T>;

export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now, maxEntries = 100): TtlCache<T> {
  const store = new Map<string, { expires: number; value: Promise<T> }>();
  return (key, load) => {
    const hit = store.get(key);
    if (hit && hit.expires > now()) return hit.value;
    const value = load();
    if (store.size >= maxEntries) {
      const oldest = store.keys().next();
      if (!oldest.done) store.delete(oldest.value);
    }
    store.set(key, { expires: now() + ttlMs, value });
    value.catch(() => store.delete(key));
    return value;
  };
}
