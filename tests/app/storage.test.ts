import assert from "node:assert/strict";
import { test } from "node:test";
import { safeStorage } from "../../src/app/lib/storage.ts";

/** A store as the browser's are: what's kept is its own properties. */
class FakeStore {
  [key: string]: unknown;
  getItem(key: string): string | null {
    return Object.hasOwn(this, key) ? String(this[key]) : null;
  }
  setItem(key: string, value: string): void {
    this[key] = value;
  }
  removeItem(key: string): void {
    delete this[key];
  }
}

function storeWith(kept: Record<string, string> = {}): FakeStore {
  return Object.assign(new FakeStore(), kept);
}

const blocked = safeStorage(() => {
  throw new Error("site data is blocked");
});

class FullStore extends FakeStore {
  override setItem(): void {
    throw new Error("the store is full");
  }
}

test("what was stored under a key is read back", () => {
  const store = storeWith();
  safeStorage(() => store).set("portfolio:a", "one");
  assert.equal(safeStorage(() => store).get("portfolio:a"), "one");
});

test("a key with nothing stored reads as null", () => {
  assert.equal(safeStorage(() => storeWith()).get("portfolio:a"), null);
});

test("a value is stored as JSON", () => {
  const store = storeWith();
  safeStorage(() => store).setJson("portfolio:a", ["x", 1]);
  assert.equal(store.getItem("portfolio:a"), '["x",1]');
});

test("stored JSON is read back as the value", () => {
  const store = storeWith({ "portfolio:a": '{"about":"Me"}' });
  assert.deepEqual(safeStorage(() => store).getJson("portfolio:a"), { about: "Me" });
});

test("stored text that isn't JSON reads as null", () => {
  const store = storeWith({ "portfolio:a": "{not json" });
  assert.equal(safeStorage(() => store).getJson("portfolio:a"), null);
});

test("a key with nothing stored reads as null JSON", () => {
  assert.equal(safeStorage(() => storeWith()).getJson("portfolio:a"), null);
});

test("clearing forgets every key that starts with the prefix, and no other", () => {
  const store = storeWith({ "portfolio:chats:en": "[]", "portfolio:chats:ja": "[]", "portfolio:folded": "[]" });
  safeStorage(() => store).clear("portfolio:chats:");
  assert.deepEqual(Object.keys(store), ["portfolio:folded"]);
});

test("a store that can't be reached reads as null", () => {
  assert.equal(blocked.get("portfolio:a"), null);
});

test("a store that can't be reached reads as null JSON", () => {
  assert.equal(blocked.getJson("portfolio:a"), null);
});

test("writing to a store that can't be reached doesn't throw", () => {
  assert.doesNotThrow(() => blocked.setJson("portfolio:a", [1]));
});

test("clearing a store that can't be reached doesn't throw", () => {
  assert.doesNotThrow(() => blocked.clear("portfolio:"));
});

test("writing to a store that's full doesn't throw", () => {
  const full = new FullStore();
  assert.doesNotThrow(() => safeStorage(() => full).set("portfolio:a", "one"));
});
