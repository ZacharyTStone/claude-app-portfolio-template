import assert from "node:assert/strict";
import { test } from "node:test";
import { label, loopOf } from "../../../../scripts/diagram.ts";
import { pictureOf } from "../helpers.ts";

const loop = loopOf(10);
const fadingIn = loop.track("opacity", [
  [2, 0],
  [4, 1],
]).attributes;

test("A track lasts the whole loop, and repeats for ever", () => {
  assert.equal(fadingIn.dur, "10s");
  assert.equal(fadingIn.repeatCount, "indefinite");
});

test("A track holds its first value from the loop's start, and its last to the loop's end", () => {
  assert.equal(fadingIn.values, "0;0;1;1");
  assert.equal(fadingIn.keyTimes, "0;0.2;0.4;1");
});

test("A value that steps holds without a last frame", () => {
  const steps = loop.track("opacity", [[5, 1]], "steps").attributes;
  assert.equal(steps.values, "1;1");
  assert.equal(steps.keyTimes, "0;0.5");
  assert.equal(steps.calcMode, "discrete");
});

test("A track refuses a frame outside the loop", () => {
  assert.throws(() => loop.track("opacity", [[11, 1]]), /outside the loop's 10 s/);
});

test("A track refuses a frame that comes before the one it follows", () => {
  const outOfOrder = () =>
    loop.track("opacity", [
      [4, 1],
      [2, 0],
    ]);
  assert.throws(outOfOrder, /comes before the one it follows/);
});

/** Three texts, one after another, as a file's text. */
function changingTexts(rests: "first" | "last" | undefined, how: "moving" | "still"): string {
  const texts = loop.changing(
    "one",
    [
      [2, "two"],
      [4, "three"],
    ],
    (text) => label(text, { x: 0, y: 0 }),
    rests,
  );
  return pictureOf([texts], how);
}

test("Text that changes rests on its first text", () => {
  assert.match(changingTexts(undefined, "still"), />one</);
  assert.doesNotMatch(changingTexts(undefined, "still"), />two<|>three</);
});

test("Text that changes rests on its last text when the picture ends on that", () => {
  assert.match(changingTexts("last", "still"), />three</);
  assert.doesNotMatch(changingTexts("last", "still"), />one<|>two</);
});

for (const rests of ["first", "last"] as const) {
  test(`Text that rests on its ${rests} text shows each in its turn while the picture moves`, () => {
    const moving = changingTexts(rests, "moving");
    assert.match(moving, />one<animate [^>]*values="1;0"[^>]*keyTimes="0;0.2"/);
    assert.match(moving, />two<animate [^>]*values="0;1;0"[^>]*keyTimes="0;0.2;0.4"/);
    assert.match(moving, />three<animate [^>]*values="0;1"[^>]*keyTimes="0;0.4"/);
  });
}
