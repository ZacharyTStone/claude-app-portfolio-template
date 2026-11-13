import assert from "node:assert/strict";
import { test } from "node:test";
import { loopOf } from "../../../../scripts/diagram.ts";
import { A_PATH } from "../helpers.ts";

const loop = loopOf(10);
const eased = loop.along(A_PATH, 2, 4).attributes;
const even = loop.along(A_PATH, 2, 4, { pace: "even" }).attributes;

test("Movement along a path eases unless it's told otherwise", () => {
  assert.equal(eased.calcMode, "spline");
});

test("Movement along a path is at the path's start until it sets off, and at its end once it arrives", () => {
  assert.equal(eased.keyTimes, "0;0.2;0.4;1");
  assert.equal(eased.keyPoints, "0;0;1;1");
});

test("Movement at an even pace keeps one speed, over the same time", () => {
  assert.equal(even.calcMode, "linear");
  assert.equal(even.keySplines, undefined);
  assert.equal(even.keyTimes, eased.keyTimes);
});

test("Movement back goes from the path's end to its start", () => {
  assert.equal(loop.along(A_PATH, 2, 4, { back: true, pace: "even" }).attributes.keyPoints, "1;1;0;0");
});
