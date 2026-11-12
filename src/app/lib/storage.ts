/* localStorage and sessionStorage, which can throw (a private window,
   blocked site data): a read then comes back empty and a write is skipped.
   Whoever reads a value checks it: it may be old, or edited by hand. */

/** One of the browser's two stores, with reads and writes that never throw. */
export type SafeStorage = {
  /** The text stored under `key`: null for nothing, or when it can't be read. */
  get(key: string): string | null;
  /** Stores text under `key`, if the browser lets it. */
  set(key: string, value: string): void;
  /** What's stored under `key` as JSON, unchecked: null for nothing, or for
      text that isn't JSON. */
  getJson(key: string): unknown;
  /** Stores a value under `key`, as JSON. */
  setJson(key: string, value: unknown): void;
  /** Forgets every key that starts with `prefix`. */
  clear(prefix: string): void;
};

/** A store that never throws. It takes a function, not the store, because
    only naming `localStorage` can throw where site data is blocked: the
    store is asked for inside each `try`. */
function safeStorage(openStore: () => Storage): SafeStorage {
  function get(key: string): string | null {
    try {
      return openStore().getItem(key);
    } catch {
      return null;
    }
  }
  function set(key: string, value: string): void {
    try {
      openStore().setItem(key, value);
    } catch {}
  }
  function getJson(key: string): unknown {
    try {
      return JSON.parse(get(key) ?? "null");
    } catch {
      return null;
    }
  }
  const setJson = (key: string, value: unknown): void => set(key, JSON.stringify(value));
  function clear(prefix: string): void {
    try {
      const store = openStore();
      for (const key of Object.keys(store)) if (key.startsWith(prefix)) store.removeItem(key);
    } catch {}
  }
  return { get, set, getJson, setJson, clear };
}

/** Kept in this browser. */
export const local = safeStorage(() => localStorage);
/** Kept until this tab of the browser is closed. */
export const session = safeStorage(() => sessionStorage);
