/* The globe's arithmetic (src/app/globe/sphere.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coordinatesOf,
  daylight,
  latticePoint,
  seenFrom,
  sunAt,
  turnTowards,
  vectorOf,
  wayBetween,
  type Coordinates,
  type Vector,
} from "../../../src/app/globe/sphere.ts";

const NEW_YORK: Coordinates = [-74.01, 40.71];
const LONDON: Coordinates = [-0.13, 51.51];
const length = ([x, y, z]: Vector): number => Math.hypot(x, y, z);
const near = (actual: number, expected: number, within = 1e-6): void =>
  assert.ok(Math.abs(actual - expected) <= within, `${actual} isn't within ${within} of ${expected}`);

test("the lattice runs from the north pole to the south, every point on the globe", () => {
  const count = 1000;
  near(latticePoint(0, count)[2], 1);
  near(latticePoint(count - 1, count)[2], -1);
  for (const i of [1, 250, 500, 998]) near(length(latticePoint(i, count)), 1);
});

test("a place is where it was after it's made a point and read back", () => {
  const [longitude, latitude] = coordinatesOf(vectorOf(NEW_YORK));
  near(longitude, NEW_YORK[0]);
  near(latitude, NEW_YORK[1]);
});

test("seen from above a place, it's in the middle and nearest", () => {
  const { across, up, depth } = seenFrom({ longitude: 140, latitude: 37 }, vectorOf([140, 37]));
  near(across, 0);
  near(up, 0);
  near(depth, 1);
});

test("seen from above a place, what's east of it is to the right, what's north is up, and the far side is hidden", () => {
  const view = { longitude: 0, latitude: 0 };
  assert.ok(seenFrom(view, vectorOf([30, 0])).across > 0);
  assert.ok(seenFrom(view, vectorOf([0, 30])).up > 0);
  near(seenFrom(view, vectorOf([180, 0])).depth, -1);
});

test("a turn from America to Japan goes west, over the Pacific", () => {
  assert.equal(turnTowards(-65, 146), -65 - 149);
});

test("a turn across the 180th meridian goes the short way", () => {
  assert.equal(turnTowards(170, -170), 190);
});

test("the way between two places starts and ends at them, over the globe", () => {
  const way = wayBetween(NEW_YORK, LONDON, 10);
  assert.equal(way.length, 11);
  for (const [index, place] of [
    [0, NEW_YORK],
    [10, LONDON],
  ] as const) {
    const [longitude, latitude] = coordinatesOf(way[index] ?? [0, 0, 0]);
    near(longitude, place[0]);
    near(latitude, place[1]);
  }
  for (const point of way) near(length(point), 1);
});

test("the way from New York to London is the great circle, which bends north of both", () => {
  const middle = coordinatesOf(wayBetween(NEW_YORK, LONDON, 10)[5] ?? [0, 0, 0]);
  assert.ok(middle[1] > LONDON[1]);
});

test("at noon in Greenwich on the June solstice, the sun is over the Tropic of Cancer at 0°", () => {
  const [longitude, latitude] = coordinatesOf(sunAt(new Date("2026-06-21T12:00:00Z")));
  near(longitude, 0, 0.01);
  near(latitude, 23.44, 0.1);
});

test("at midnight in Greenwich, the sun is over the 180th meridian", () => {
  near(Math.abs(coordinatesOf(sunAt(new Date("2026-03-20T00:00:00Z")))[0]), 180, 0.01);
});

test("under the sun it's day, and on the far side it's night", () => {
  const sun = sunAt(new Date("2026-06-21T12:00:00Z"));
  assert.equal(daylight(sun, sun), 1);
  assert.equal(daylight([-sun[0], -sun[1], -sun[2]], sun), 0);
});
