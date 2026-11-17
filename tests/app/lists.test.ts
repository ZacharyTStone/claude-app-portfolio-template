/* src/app/lib/lists.ts: each item of a list once. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { onceEach } from "../../src/app/lib/lists.ts";

test("each item is kept once, where it first comes, the list's order otherwise as it was", () => {
  assert.deepEqual(
    onceEach(["b", "a", "b", "c", "a"], (item) => item),
    ["b", "a", "c"],
  );
});

test("an item is another's double by its key: the first of them is the one kept", () => {
  const rows = [
    { href: "https://a.example.com/", from: "one" },
    { href: "https://b.example.com/", from: "one" },
    { href: "https://a.example.com/", from: "two" },
  ];
  assert.deepEqual(
    onceEach(rows, (row) => row.href).map((row) => `${row.from} ${row.href}`),
    ["one https://a.example.com/", "one https://b.example.com/"],
  );
});

test("an empty list stays empty", () => {
  assert.deepEqual(
    onceEach([], () => ""),
    [],
  );
});
