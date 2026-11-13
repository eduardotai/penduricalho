// In-memory localStorage for store tests under Node. Import before the store.
const data = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  get length() {
    return data.size;
  },
  clear: () => data.clear(),
  getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
  key: (i: number) => [...data.keys()][i] ?? null,
  removeItem: (k: string) => void data.delete(k),
  setItem: (k: string, v: string) => void data.set(k, String(v)),
};
export {};
