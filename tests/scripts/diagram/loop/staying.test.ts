import assert from "node:assert/strict";
import { test } from "node:test";
import { loopOf } from "../../../../scripts/diagram.ts";

const story = loopOf(10, { from: 8, to: 9 });

test("What comes at a moment stays until the loop clears", () => {
  const since = story.since(2, 0.5).attributes;
  assert.equal(since.values, "0;0;1;1;0;0");
  assert.equal(since.keyTimes, "0;0.2;0.25;0.8;0.9;1");
});

test("What the loop starts with comes as fast as the loop clears", () => {
  const fromTheStart = story.fromTheStart().attributes;
  assert.equal(fromTheStart.values, "0;1;1;0;0");
  assert.equal(fromTheStart.keyTimes, "0;0.1;0.8;0.9;1");
});

test("What something else brings in is only taken away", () => {
  const untilClear = story.untilClear().attributes;
  assert.equal(untilClear.values, "1;1;0;0");
  assert.equal(untilClear.keyTimes, "0;0.8;0.9;1");
});

test("What comes last is there by the time the loop starts to clear", () => {
  assert.equal(story.since(7.9, 0.5).attributes.keyTimes, "0;0.79;0.8;0.8;0.9;1");
});

test("Nothing comes after the loop has started to clear", () => {
  assert.throws(() => story.since(8.5), /comes at 8\.5 s comes after the loop has started to clear, at 8 s/);
});

test("A loop clears in its last second unless it's told when", () => {
  const { clears } = loopOf(10);
  assert.ok(clears.from > 9 && clears.from < clears.to && clears.to < 10);
});

test("A loop clears when it's told to", () => {
  assert.deepEqual(loopOf(10, { from: 7, to: 8 }).clears, { from: 7, to: 8 });
});

test("A loop refuses to clear outside itself, or backwards", () => {
  assert.throws(() => loopOf(10, { from: 9, to: 11 }), /can't clear from 9 s to 11 s/);
  assert.throws(() => loopOf(10, { from: 9, to: 8 }), /can't clear from 9 s to 8 s/);
});
