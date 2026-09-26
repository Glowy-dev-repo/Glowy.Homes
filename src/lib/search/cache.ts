/** Tiny TTL cache for API responses keyed by canonical query string (docs/02 section 7: 60s). */
export function createTtlCache<V>(ttlMs: number, maxEntries = 500) {
  const store = new Map<string, { at: number; value: V }>();
  return {
    get(key: string): V | undefined {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (Date.now() - hit.at > ttlMs) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: V) {
      if (store.size >= maxEntries) store.delete(store.keys().next().value!);
      store.set(key, { at: Date.now(), value });
    },
  };
}
