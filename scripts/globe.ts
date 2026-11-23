/* `npm run globe` finds which of the home screen globe's points are land, and writes them into
   src/app/globe/land.ts, which the page loads only when it draws the globe. The points are the browser's
   own (src/app/globe/sphere.ts); the land is Natural Earth's at its coarsest (1:110m), from the world-atlas
   package. tests/scripts/globe.test.ts fails while the file isn't what this writes. */
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import worldLand from "world-atlas/land-110m.json" with { type: "json" };
import type { Coordinates } from "../src/config/globe.ts";
import { coordinatesOf, latticePoint } from "../src/app/globe/sphere.ts";

/** How many points the globe has, land and sea: one about every 0.86°, as close as its dots can sit at the
    size the home screen draws them. */
const POINT_COUNT = 70_000;
/** South of this is Antarctica, which would only crowd the globe's lower edge: none of it is drawn. */
const SOUTHERNMOST = -60;
export const LAND_FILE = fileURLToPath(new URL("../src/app/globe/land.ts", import.meta.url));

/** World-atlas's land: one MultiPolygon, its rings made of arcs (a negative index is an arc reversed), each
    arc a run of whole-number steps that `transform` turns into degrees. */
type Topology = {
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: Array<Array<[number, number]>>;
  objects: { land: { geometries: Array<{ arcs: number[][][] }> } };
};

/** A closed line around land or a lake, in degrees, with the box it fits in. Its longitudes run on past
    ±180 where it crosses that line (Russia does), so its sides are never the whole way round. */
type Ring = { points: Coordinates[]; south: number; north: number; west: number; east: number };

function arcsOf({ transform, arcs }: Topology): Coordinates[][] {
  const [[scaleX, scaleY], [startX, startY]] = [transform.scale, transform.translate];
  return arcs.map((arc) => {
    let [x, y] = [0, 0];
    return arc.map(([stepX, stepY]): Coordinates => {
      [x, y] = [x + stepX, y + stepY];
      return [x * scaleX + startX, y * scaleY + startY];
    });
  });
}

/** Each longitude within 180° of the one before it. */
function unwrapped(points: Coordinates[]): Coordinates[] {
  let before = points[0]?.[0] ?? 0;
  return points.map(([longitude, latitude]): Coordinates => {
    before = longitude + 360 * Math.round((before - longitude) / 360);
    return [before, latitude];
  });
}

function ringOf(arcIndexes: number[], arcs: Coordinates[][]): Ring {
  const joined = arcIndexes.flatMap((index, place) => {
    const arc = index >= 0 ? (arcs[index] ?? []) : [...(arcs[~index] ?? [])].reverse();
    // Each arc after the first starts where the one before it ended.
    return place === 0 ? arc : arc.slice(1);
  });
  const points = unwrapped(joined);
  const [longitudes, latitudes] = [points.map(([longitude]) => longitude), points.map(([, latitude]) => latitude)];
  return {
    points,
    south: Math.min(...latitudes),
    north: Math.max(...latitudes),
    west: Math.min(...longitudes),
    east: Math.max(...longitudes),
  };
}

function landRings(): Ring[] {
  // Its arcs' steps are pairs, which JSON can't say.
  const topology = worldLand as unknown as Topology;
  const arcs = arcsOf(topology);
  return topology.objects.land.geometries.flatMap((multiPolygon) =>
    multiPolygon.arcs.flatMap((polygon) => polygon.map((ring) => ringOf(ring, arcs))),
  );
}

/** How many of a ring's sides a line due east from `place` crosses. */
function crossings({ points }: Ring, [longitude, latitude]: Coordinates): number {
  let count = 0;
  points.forEach(([lonA, latA], i) => {
    const [lonB, latB] = points[(i + 1) % points.length] ?? [lonA, latA];
    if (latA > latitude === latB > latitude) return;
    const lonWhereItCrosses = lonA + ((latitude - latA) / (latB - latA)) * (lonB - lonA);
    if (lonWhereItCrosses > longitude) count++;
  });
  return count;
}

/** How many of a ring's sides a line due east from `place` crosses, with `place` taken round the globe to
    where the ring's longitudes run, if it's inside its box at all. */
function crossingsOfRing(ring: Ring, [longitude, latitude]: Coordinates): number {
  if (latitude < ring.south || latitude > ring.north) return 0;
  const sameLongitude = [longitude, longitude + 360, longitude - 360].find(
    (lon) => lon >= ring.west && lon <= ring.east,
  );
  return sameLongitude === undefined ? 0 : crossings(ring, [sameLongitude, latitude]);
}

/** On land when a line due east crosses the rings an odd number of times: a lake's ring takes its water
    back out. */
function isLand(place: Coordinates, rings: Ring[]): boolean {
  if (place[1] < SOUTHERNMOST) return false;
  return rings.reduce((count, ring) => count + crossingsOfRing(ring, place), 0) % 2 === 1;
}

/** src/app/globe/land.ts as `npm run globe` writes it. */
export function landFileText(): string {
  const rings = landRings();
  const bits = new Uint8Array(Math.ceil(POINT_COUNT / 8));
  for (let i = 0; i < POINT_COUNT; i++) {
    if (isLand(coordinatesOf(latticePoint(i, POINT_COUNT)), rings)) bits[i >> 3] = (bits[i >> 3] ?? 0) | (1 << (i & 7));
  }
  return [
    "/* Which of the globe's points (src/app/globe/sphere.ts) are land, a bit each in turn, the lowest bit of",
    "   each byte first: written by `npm run globe` (scripts/globe.ts) from Natural Earth's land. The page",
    "   loads it only to draw the globe. Don't edit it. */",
    "export const LAND = {",
    `  points: ${POINT_COUNT},`,
    `  bits: "${Buffer.from(bits).toString("base64")}",`,
    "};",
    "",
  ].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  writeFileSync(LAND_FILE, landFileText());
  console.log(`Wrote ${LAND_FILE}`);
}
