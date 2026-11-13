import assert from "node:assert/strict";
import { test } from "node:test";
import { box, COLOR, loopOf } from "../../../../scripts/diagram.ts";
import { motionsOn } from "../helpers.ts";

const loop = loopOf(10);
const A_POINT = { x: 0, y: 0 };
const A_PLACE = { x: 10, y: 20, width: 30, height: 40 };

test("A flash with no times never flashes", () => {
  assert.equal(loop.flash([]).attributes.values, "0;0");
});

test("A ripple with no times has no motion", () => {
  assert.deepEqual(motionsOn(loop.ripple(A_POINT, [])), []);
});

test("A flash that starts before the one before it is over says so, and what to do", () => {
  assert.throws(
    () => loop.flash([1, 1.5]),
    /The flash at 1\.5 s starts before the one at 1 s is over \(it lasts 0\.7 s\): give it a shorter `fall`/,
  );
});

test("Two flashes that are each over before the next are fine", () => {
  assert.doesNotThrow(() => loop.flash([1, 1.5], { fall: 0.4 }));
});

test("A ripple that starts before the one before it is over says so, and what to do", () => {
  assert.throws(
    () => loop.ripple(A_POINT, [1, 1.5]),
    /The ripple at 1\.5 s starts before the one at 1 s is over \(it lasts 0\.9 s\): give each a ripple of its own/,
  );
});

test("Two ripples that overlap are fine as a ripple each", () => {
  assert.doesNotThrow(() => [1, 1.5].map((time) => loop.ripple(A_POINT, [time])));
});

const light = loop.light(box(A_PLACE, { fill: COLOR.accent, line: "none" }), [2], { peak: 0.4 });

test("A light is its overlay, out of sight while nothing moves", () => {
  assert.equal(light.onlyWhenMoving, true);
  assert.equal(light.attributes.opacity, 0);
  assert.equal(light.attributes.fill, COLOR.accent);
});

test("A light flashes to its peak at its time", () => {
  assert.equal(motionsOn(light)[0]?.values, "0;0;0.4;0;0");
});

test("An edge's light is the outline of its box", () => {
  const edge = loop.edgeLight(A_PLACE, [2], { radius: 30 });
  assert.equal(edge.onlyWhenMoving, true);
  assert.equal(edge.attributes.fill, "none");
  assert.equal(edge.attributes.rx, 30);
  assert.equal(edge.attributes.x, A_PLACE.x);
});

test("An edge nothing arrives at never lights", () => {
  assert.doesNotThrow(() => loop.edgeLight(A_PLACE, []));
});
