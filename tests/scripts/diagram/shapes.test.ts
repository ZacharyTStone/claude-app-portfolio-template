import assert from "node:assert/strict";
import { test } from "node:test";
import { aroundOrigin, box, centreOf, COLOR, placed } from "../../../scripts/diagram.ts";
import { aBox } from "./helpers.ts";

test("A rectangle around the origin has its middle there", () => {
  assert.deepEqual(aroundOrigin(10, 6), { x: -5, y: -3, width: 10, height: 6 });
  assert.deepEqual(centreOf(aroundOrigin(10, 6)), { x: 0, y: 0 });
});

test("A placed shape is in a group moved to its point, which is written rounded", () => {
  assert.equal(placed({ x: 100 / 3, y: 20 }, aBox()).attributes.transform, "translate(33.33 20)");
});

test("A box's outline is lit along its top, a highlighted one warmly, and another colour is left as it is", () => {
  assert.equal(aBox().attributes.stroke, "url(#finish-rim)");
  assert.equal(box(aroundOrigin(10, 6), { line: COLOR.accentLine }).attributes.stroke, "url(#finish-warm-rim)");
  assert.equal(box(aroundOrigin(10, 6), { line: COLOR.accent }).attributes.stroke, COLOR.accent);
  assert.equal(box(aroundOrigin(10, 6), { line: "none" }).attributes.stroke, undefined);
});

test("A surface big enough to be a thing of its own is lifted on a shadow; a small one, a square one or a bar isn't", () => {
  assert.equal(box(aroundOrigin(200, 120)).attributes.filter, "url(#finish-lift)");
  assert.equal(box(aroundOrigin(200, 120), { fill: COLOR.accentBox }).attributes.filter, "url(#finish-lift)");
  assert.equal(aBox().attributes.filter, undefined, "a small box");
  assert.equal(
    box(aroundOrigin(200, 120), { radius: 0 }).attributes.filter,
    undefined,
    "a square one: a piece of another",
  );
  assert.equal(
    box(aroundOrigin(200, 120), { fill: COLOR.mark }).attributes.filter,
    undefined,
    "one that isn't a surface",
  );
});
