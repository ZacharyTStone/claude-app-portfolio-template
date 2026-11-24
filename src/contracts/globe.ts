/* What the home screen's globe and the Worker agree on, when the globe
   shows its visitors (the config's globe.visitors): the page posts to
   /visits once it shows, and is told roughly where the visitor is (to a
   tenth of a degree, said to them alone) and where the site's visitors
   have come from (each to the nearest whole degree, about 100 km, with how
   many came from there). No town is said, and nothing that could single
   out a visitor is kept or sent. */

import { isRecord } from "./guards.ts";

export const VISITS_PATH = "/visits";

/** A place, in degrees: north and east are above 0. */
type Spot = { latitude: number; longitude: number };

/** Roughly where this visitor is. */
export type You = Spot;

/** One square of the globe, a degree on a side, and how many visitors have
    come from it: its middle's latitude, then longitude, then the count. */
export type VisitedPlace = readonly [latitude: number, longitude: number, visits: number];

export type Visits = { you: You | null; places: VisitedPlace[] };

/** The most places a reply lists: the ones most visitors came from. */
export const MOST_PLACES = 400;

const isNumberWithin = (value: unknown, limit: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;

function readYou(said: unknown): You | null {
  if (!isRecord(said) || !isNumberWithin(said.latitude, 90) || !isNumberWithin(said.longitude, 180)) return null;
  return { latitude: said.latitude, longitude: said.longitude };
}

function readPlace(said: unknown): VisitedPlace | null {
  if (!Array.isArray(said)) return null;
  const [latitude, longitude, visits]: unknown[] = said;
  const isPlace = isNumberWithin(latitude, 90) && isNumberWithin(longitude, 180);
  return isPlace && typeof visits === "number" && visits >= 1 ? [latitude, longitude, Math.floor(visits)] : null;
}

/** A reply from /visits as the page reads it: what can't be read is left
    out, and a reply that isn't one at all is none. */
export function readVisits(said: unknown): Visits | null {
  if (!isRecord(said) || !Array.isArray(said.places)) return null;
  const places = said.places.map(readPlace).filter((place): place is VisitedPlace => place !== null);
  return { you: readYou(said.you), places: places.slice(0, MOST_PLACES) };
}
