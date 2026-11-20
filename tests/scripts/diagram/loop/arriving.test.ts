import assert from "node:assert/strict";
import { test } from "node:test";
import { box, COLOR, dot, loopOf } from "../../../../scripts/diagram.ts";
import { aBox, pictureOf } from "../helpers.ts";

const loop = loopOf(10);
const arrivals = [
  loop.popping(aBox(), { x: 30, y: 40 }, 2),
  loop.rising(box({ x: 1, y: 2, width: 3, height: 4 }), 3),
  loop.gliding(dot({ x: 0, y: 0 }, 5), { x: 10, y: 20 }, { x: 60, y: 70 }, { from: 4, to: 5 }),
];
const still = pictureOf(arrivals, "still");
const movingPicture = pictureOf(arrivals, "moving");

test("What pops in rests at its point in the still picture", () => {
  assert.match(still, /<g transform="translate\(30 40\)"><g><rect x="-5" y="-3"/);
});

test("What rises rests where it was drawn", () => {
  assert.match(still, /<g><rect x="1" y="2"/);
});

test("What glides rests where it went", () => {
  assert.match(still, /<g transform="translate\(60 70\)"><g><circle cx="0" cy="0"/);
});

test("What pops in swells past its size, dips under it and settles, as a spring does", () => {
  assert.match(movingPicture, /<animateTransform [^>]*type="scale"[^>]*values="0;0;1\.18;0\.95;1;1"/);
});

const aMarker = loop.popping(dot({ x: 0, y: 0 }, 10, { fill: COLOR.accent }), { x: 50, y: 50 }, 2);

test("A small pop of the accent throws a ring of sparks while the picture moves, and the still has none", () => {
  const sparks = pictureOf([aMarker], "moving").match(/<circle [^>]*fill="#f0a184" opacity="0">/g) ?? [];
  assert.equal(sparks.length, 6);
  assert.doesNotMatch(pictureOf([aMarker], "still"), /#f0a184/);
});

test("A pop that isn't the accent's, or is too big, throws none", () => {
  assert.doesNotMatch(movingPicture, /#f0a184/, "a grey box");
  const big = loop.popping(dot({ x: 0, y: 0 }, 40, { fill: COLOR.accent }), { x: 50, y: 50 }, 2);
  assert.doesNotMatch(pictureOf([big], "moving"), /#f0a184/, "a dot wider than a marker");
});

test("What rises comes up into its place", () => {
  assert.match(movingPicture, /<animateTransform [^>]*type="translate"[^>]*values="0 16;0 16;0 0;0 0"/);
});

test("A glide's path is written from where it ends: here it starts 50 back and 50 up", () => {
  assert.match(movingPicture, /<animateMotion path="M-50 -50 Q[^"]* 0 0"/);
});

test("Each comes at its moment, and all go together as the loop clears", () => {
  const opacityKeyTimes = [...movingPicture.matchAll(/attributeName="opacity"[^>]*keyTimes="([^"]*)"/g)].map(
    (match) => match[1],
  );
  assert.equal(opacityKeyTimes.length, 3);
  for (const keyTimes of opacityKeyTimes) assert.match(keyTimes ?? "", /;0\.91;0\.955;1$/);
});
