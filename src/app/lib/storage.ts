/* localStorage and sessionStorage, which can throw (a private window,
   blocked site data): a read then comes back empty and a write is skipped.
   Whoever reads a value checks it: it may be old, or edited by hand. */

function wrap(area: () => Storage) {
  function get(key: string): string | null {
    try {
      return area().getItem(key);
    } catch {
      return null;
    }
  }
  function set(key: string, value: string): void {
    try {
      area().setItem(key, value);
    } catch {}
  }
  /** What's stored under `key` as JSON, unchecked: null for nothing. */
  function getJson(key: string): unknown {
    try {
      return JSON.parse(get(key) ?? "null");
    } catch {
      return null;
    }
  }
  const setJson = (key: string, value: unknown): void => set(key, JSON.stringify(value));
  /** Forgets every key that starts with `prefix`. */
  function clear(prefix: string): void {
    try {
      for (const key of Object.keys(area())) if (key.startsWith(prefix)) area().removeItem(key);
    } catch {}
  }
  return { get, set, getJson, setJson, clear };
}

/** Kept in this browser. */
export const local = wrap(() => localStorage);
/** Kept until this tab of the browser is closed. */
export const session = wrap(() => sessionStorage);
