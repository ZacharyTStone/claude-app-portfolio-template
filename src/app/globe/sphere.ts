/* The globe's arithmetic, with no page: where its points are, how a point
   looks from above a place, the way from one place to another, and where
   the sun is. The browser draws with it, and scripts/globe.ts finds the
   land with the same points, so the two always agree. */

const RADIANS_PER_DEGREE = Math.PI / 180;
/** The turn between one point of the lattice and the next, which spreads
    them evenly. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** How far the sun's path tilts from the equator. */
const TILT_DEGREES = 23.44;
/** How far past the edge of daylight dusk reaches, and how wide it is, on a
    sphere of radius 1. */
const DUSK_STARTS = -0.08;
const DUSK_WIDTH = 0.25;

/** A place as the globe's arithmetic takes it, in degrees: its longitude,
    then its latitude (the config's Place, in the order x and y go). */
export type Coordinates = readonly [longitude: number, latitude: number];

/** A point on a sphere of radius 1: x towards 0° on the equator, y towards
    90° east, z towards the north pole. */
export type Vector = readonly [x: number, y: number, z: number];

/** Where the globe is seen from: straight above this place, in degrees. A
    longitude past ±180 is the same as one inside it. */
export type View = { longitude: number; latitude: number };

/** A point as seen from a view: how far across (east) and up (north) of the
    middle it is, on a globe of radius 1, and its depth, below 0 on the far
    side. */
export type Seen = { across: number; up: number; depth: number };

export const clamp = (value: number, low = 0, high = 1): number => Math.min(high, Math.max(low, value));

/** Slow, then fast, then slow: from 0 to 1 as `t` goes from 0 to 1. */
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** The i-th of `count` points spread evenly over the globe, from the north
    pole to the south. */
export function latticePoint(i: number, count: number): Vector {
  const z = 1 - (2 * i) / (count - 1);
  const across = Math.sqrt(1 - z * z);
  const angle = GOLDEN_ANGLE * i;
  return [across * Math.cos(angle), across * Math.sin(angle), z];
}

export function vectorOf([longitude, latitude]: Coordinates): Vector {
  const lon = longitude * RADIANS_PER_DEGREE;
  const lat = latitude * RADIANS_PER_DEGREE;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

export function coordinatesOf([x, y, z]: Vector): Coordinates {
  return [Math.atan2(y, x) / RADIANS_PER_DEGREE, Math.asin(clamp(z, -1, 1)) / RADIANS_PER_DEGREE];
}

/** Each point of `points` (x, y and z in turn) as seen from `view`, written
    into `seen` (across, up and depth in turn): the browser does this for
    every point of land in every frame, so it makes nothing new. */
export function seeAll(view: View, points: Float32Array, seen: Float32Array): void {
  const lon = view.longitude * RADIANS_PER_DEGREE;
  const lat = view.latitude * RADIANS_PER_DEGREE;
  const [sinLon, cosLon, sinLat, cosLat] = [Math.sin(lon), Math.cos(lon), Math.sin(lat), Math.cos(lat)];
  for (let i = 0; i < points.length; i += 3) {
    const [x, y, z] = [points[i] ?? 0, points[i + 1] ?? 0, points[i + 2] ?? 0];
    // How far round towards the view, on the point's own circle of latitude.
    const towards = x * cosLon + y * sinLon;
    seen[i] = y * cosLon - x * sinLon;
    seen[i + 1] = z * cosLat - towards * sinLat;
    seen[i + 2] = z * sinLat + towards * cosLat;
  }
}

/** One point as seen from `view`. */
export function seenFrom(view: View, point: Vector): Seen {
  const seen = new Float32Array(3);
  seeAll(view, new Float32Array(point), seen);
  const [across = 0, up = 0, depth = 0] = seen;
  return { across, up, depth };
}

/** How far apart two places are over the globe, in degrees. */
export function degreesApart(a: Coordinates, b: Coordinates): number {
  const [[ax, ay, az], [bx, by, bz]] = [vectorOf(a), vectorOf(b)];
  return Math.acos(clamp(ax * bx + ay * by + az * bz, -1, 1)) / RADIANS_PER_DEGREE;
}

/** The longitude a turn from `start` ends at to face `end` the short way
    round, which may be past ±180 so that what's between is the turn. */
export function turnTowards(start: number, end: number): number {
  const shortWay = ((((end - start) % 360) + 540) % 360) - 180;
  return start + shortWay;
}

/** `steps` + 1 points along the shortest way over the globe from `from` to
    `to`, both ends included. */
export function wayBetween(from: Coordinates, to: Coordinates, steps: number): Vector[] {
  const [a, b] = [vectorOf(from), vectorOf(to)];
  const angle = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
  if (angle === 0) return Array.from({ length: steps + 1 }, () => a);
  return Array.from({ length: steps + 1 }, (_, step): Vector => {
    // How much of each end a point between is made of, along the great circle.
    const ofA = Math.sin((1 - step / steps) * angle) / Math.sin(angle);
    const ofB = Math.sin((step / steps) * angle) / Math.sin(angle);
    return [ofA * a[0] + ofB * b[0], ofA * a[1] + ofB * b[1], ofA * a[2] + ofB * b[2]];
  });
}

/** The point the sun is straight above at `when`: near enough for day and
    night, as it leaves out the quarter of an hour the equation of time
    adds at most. */
export function sunAt(when: Date): Vector {
  const startOfYear = Date.UTC(when.getUTCFullYear(), 0, 0);
  const dayOfYear = (when.getTime() - startOfYear) / DAY_MS;
  const latitude = -TILT_DEGREES * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const hourOfDay = (when.getTime() % DAY_MS) / HOUR_MS;
  return vectorOf([-15 * (hourOfDay - 12), latitude]);
}

/** How lit a point is: 0 at night, 1 in daylight, and between at dusk. */
export const daylight = (point: Vector, sun: Vector): number =>
  clamp((point[0] * sun[0] + point[1] * sun[1] + point[2] * sun[2] - DUSK_STARTS) / DUSK_WIDTH);
