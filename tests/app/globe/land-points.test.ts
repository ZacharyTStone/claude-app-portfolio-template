/* The globe's land (src/app/globe/land.ts, as land-points.ts reads it): it
   has land where the world has land, and none where it has sea. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { LAND } from "../../../src/app/globe/land.ts";
import { landPoints } from "../../../src/app/globe/land-points.ts";
import { vectorOf } from "../../../src/app/globe/sphere.ts";
import type { Coordinates } from "../../../src/config/globe.ts";

const land = landPoints(LAND);

/** The points are about 0.86° apart: a place on land is within half that
    of one, and a place out at sea is well clear of every one. */
const ON_LAND_WITHIN = 0.7;
const AT_SEA_BEYOND = 1.2;

function degreesToNearestLand(place: Coordinates): number {
  const [x, y, z] = vectorOf(place);
  let nearest = -1;
  for (let i = 0; i < land.length; i += 3) {
    nearest = Math.max(nearest, (land[i] ?? 0) * x + (land[i + 1] ?? 0) * y + (land[i + 2] ?? 0) * z);
  }
  return (Math.acos(Math.min(1, nearest)) * 180) / Math.PI;
}

test("about a quarter of the globe is land, leaving out Antarctica", () => {
  const share = land.length / 3 / LAND.points;
  assert.ok(share > 0.24 && share < 0.29, `${share} of it is land`);
});

const LAND_PLACES: Array<[string, Coordinates]> = [
  ["Fukushima", [140.47, 37.75]],
  ["the Sahara", [10, 23]],
  ["Greenland", [-40, 72]],
  // Natural Earth's Russia crosses the 180th meridian.
  ["Chukotka, west of the 180th meridian", [-175, 66]],
];

for (const [name, place] of LAND_PLACES) {
  test(`${name} is land`, () => {
    assert.ok(degreesToNearestLand(place) < ON_LAND_WITHIN);
  });
}

const SEA_PLACES: Array<[string, Coordinates]> = [
  ["the middle of the Pacific", [-150, 0]],
  ["the middle of the Atlantic", [-35, 30]],
  ["the Caspian Sea, a lake inside the land", [50.5, 42]],
  ["Antarctica, which the globe leaves out", [0, -80]],
];

for (const [name, place] of SEA_PLACES) {
  test(`${name} has no land drawn`, () => {
    assert.ok(degreesToNearestLand(place) > AT_SEA_BEYOND);
  });
}
