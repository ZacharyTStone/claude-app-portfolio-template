import assert from "node:assert/strict";
import { test } from "node:test";
import { aroundOrigin, centreOf, placed } from "../../../scripts/diagram.ts";
import { aBox } from "./helpers.ts";

test("A rectangle around the origin has its middle there", () => {
  assert.deepEqual(aroundOrigin(10, 6), { x: -5, y: -3, width: 10, height: 6 });
  assert.deepEqual(centreOf(aroundOrigin(10, 6)), { x: 0, y: 0 });
});

test("A placed shape is in a group moved to its point, which is written rounded", () => {
  assert.equal(placed({ x: 100 / 3, y: 20 }, aBox()).attributes.transform, "translate(33.33 20)");
});
