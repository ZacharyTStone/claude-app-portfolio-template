/* Where the site's visitors have come from, kept in AskGuard for the home
   screen's globe: a count for each square of the globe a whole degree on a
   side (about 100 km), and which visitors have been counted today, under
   the day's hash of their address, which AskGuard deletes when the day
   ends. Nothing else of a visitor is kept: not their address, not when
   they came, not their town. */
import { MOST_PLACES, type VisitedPlace } from "../../contracts/globe.ts";

/** What it keeps: `places`, each square's count, by "latitude,longitude"
    of its middle ("36,140"); and `visited:` and a visitor's hash, true
    once they've been counted today. */
export const VISIT_KEYS = { places: "places", visited: "visited:" } as const;

/** The most squares it keeps a count for: a new square past these is
    counted nowhere, so the store stays small however many come. */
const MOST_SQUARES = 5000;

type Counts = Record<string, number>;

/** The square a place is in, by its middle: "36,140". */
export const squareOf = (latitude: number, longitude: number): string =>
  `${Math.round(latitude)},${Math.round(longitude)}`;

function countsIn(stored: unknown): Counts {
  if (typeof stored !== "object" || stored === null) return {};
  return Object.fromEntries(
    Object.entries(stored).filter(([, visits]) => typeof visits === "number" && visits > 0),
  ) as Counts;
}

/** The squares most visitors came from, most first, as AskGuard says them:
    "36,140,4;51,0,2". */
export function sayPlaces(counts: Counts): string {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MOST_PLACES)
    .map(([square, visits]) => `${square},${visits}`)
    .join(";");
}

/** What AskGuard said, as places: what isn't one is left out. */
export function readSaidPlaces(said: string): VisitedPlace[] {
  return said
    .split(";")
    .map((place) => place.split(",").map(Number))
    .filter((numbers) => numbers.length === 3 && numbers.every(Number.isFinite))
    .map(([latitude = 0, longitude = 0, visits = 0]): VisitedPlace => [latitude, longitude, visits]);
}

/** Counts a visit from `square`, once a day for each visitor (none without
    a square), and says where the site's visitors have come from. */
export async function countVisit(storage: DurableObjectStorage, visitorHash: string, square: string | null) {
  const counts = countsIn(await storage.get(VISIT_KEYS.places));
  const visitedKey = `${VISIT_KEYS.visited}${visitorHash}`;
  const isNewSquare = square !== null && !(square in counts);
  const hasRoom = !isNewSquare || Object.keys(counts).length < MOST_SQUARES;
  if (square !== null && hasRoom && !(await storage.get(visitedKey))) {
    counts[square] = (counts[square] ?? 0) + 1;
    await storage.put(VISIT_KEYS.places, counts);
    await storage.put(visitedKey, true);
  }
  return sayPlaces(counts);
}
