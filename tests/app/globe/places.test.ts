/* The globe's dots: its seed as the page carries it, and seed and counted
   places together (src/app/globe/places.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { seedPlaces, togetherPlaces } from "../../../src/app/globe/places.ts";

test("a seed is read as the page carries it", () => {
  assert.deepEqual(seedPlaces("35.68 139.69 66;52.37 4.9 69"), [
    [35.68, 139.69, 66],
    [52.37, 4.9, 69],
  ]);
});

test("what in a seed isn't a place with visits is left out", () => {
  assert.deepEqual(seedPlaces("95 0 3;35 139;10 20 0;abc"), []);
  assert.deepEqual(seedPlaces(null), []);
});

test("seed and counted places in one square are one place, with all their visits", () => {
  assert.deepEqual(
    togetherPlaces(
      [
        [35.68, 139.69, 66],
        [52.37, 4.9, 1],
      ],
      [[36, 140, 2]],
    ),
    [
      [36, 140, 68],
      [52, 5, 1],
    ],
  );
});
