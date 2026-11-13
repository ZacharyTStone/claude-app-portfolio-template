import assert from "node:assert/strict";
import { test } from "node:test";
import { loopOf } from "../../../../scripts/diagram.ts";
import { A_PATH, aBox, motionsOn, pictureOf } from "../helpers.ts";

const loop = loopOf(10);
const carried = loop.carried(aBox(), A_PATH, 2, 4);
const [fades, moves] = motionsOn(carried);

test("What's carried along a path is there only while the picture moves", () => {
  assert.equal(carried.onlyWhenMoving, true);
  assert.equal(carried.attributes.opacity, 0, "it rests out of sight");
  assert.doesNotMatch(pictureOf([carried], "still"), /<g/, "and the still picture doesn't have it");
});

test("What's carried comes as it sets off, and goes as it arrives", () => {
  assert.equal(fades?.values, "0;0;1;1;0;0");
  assert.equal(fades?.keyTimes, "0;0.1999;0.215;0.395;0.415;1");
});

test("What's carried moves along its path, eased", () => {
  assert.equal(moves?.path, A_PATH);
  assert.equal(moves?.calcMode, "spline");
});

const [goesEarly, backAndEven] = motionsOn(
  loop.carried([aBox(), aBox()], A_PATH, 2, 4, { back: true, pace: "even", fadesBefore: 1 }),
);

test("What's carried starts to go as long before it arrives as it's told", () => {
  assert.equal(goesEarly?.keyTimes, "0;0.1999;0.215;0.3;0.415;1");
});

test("What's carried goes back, and at an even pace, when it's told", () => {
  assert.equal(backAndEven?.keyPoints, "1;1;0;0");
  assert.equal(backAndEven?.calcMode, "linear");
});
