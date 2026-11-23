/* Where the globe sits under the home screen's text, and where it is at
   each moment of its turn: worked out with no page, so the unit tests use
   it as it is. */
import { clamp, easeInOut, turnTowards, type Coordinates } from "./sphere.ts";

/** Where the globe sits on its canvas, in CSS pixels: the canvas's size,
    the globe's middle and radius, and the latitude it's seen from. Its
    middle is under the canvas, so only its top shows. */
export type Placing = { width: number; height: number; x: number; y: number; radius: number; latitude: number };

/** One moment of the turn: the longitude the globe faces, how much of the
    way is drawn, how far it has settled since landing, and how far the
    whole globe has faded in, each of the last three 0 to 1. */
export type Moment = { longitude: number; drawn: number; settled: number; shown: number };

/** The longitudes the turn starts and ends at. */
export type Turn = { start: number; end: number };

/** The space between the text and the globe's rim. */
const GAP_UNDER_TEXT = 40;
/** How much of the globe has to show under the text for it to be drawn. */
const LEAST_SHOWING = 150;
const RADIUS = { shareOfWidth: 0.8, least: 420, most: 1000 };
/** How far down what shows of the globe its marker sits, and how far it
    stays above the canvas's bottom. */
const MARKER_SHARE = 0.6;
const MARKER_ABOVE_BOTTOM = 64;
/** How far east of `here` the turn ends, so the marker and the words beside
    it sit near the middle. */
const ENDS_EAST_OF_HERE = 6;
/** How far east of where it's from the turn starts, and how far it turns
    when there's nowhere it's from. */
const STARTS_EAST_OF_FROM = 10;
const TURN_WITHOUT_FROM = 60;
/** The least a turn turns, in degrees of longitude. */
const SHORTEST_TURN = 30;

/** When each part of the turn starts and how long it takes, in ms. */
const PLAY = {
  fadeMs: 500,
  turnStarts: 100,
  turnMs: 2300,
  wayStarts: 250,
  wayMs: 2150,
  lands: 2300,
  settleMs: 600,
} as const;

/** When the globe lands on where its owner is, and its marker shows. */
export const LANDS_MS = PLAY.lands;
/** When the turn is over. */
export const PLAY_MS = PLAY.lands + PLAY.settleMs;

/** Where the globe sits on a canvas `width` × `height` whose text ends
    `textBottom` from its top, seen from above `latitude` turned so that a
    marker there sits MARKER_SHARE of the way down what shows. None when
    there's too little room under the text. */
export function placeGlobe(width: number, height: number, textBottom: number, latitude: number): Placing | null {
  const rim = textBottom + GAP_UNDER_TEXT;
  if (height - rim < LEAST_SHOWING) return null;
  const radius = clamp(width * RADIUS.shareOfWidth, RADIUS.least, RADIUS.most);
  const y = rim + radius;
  const markerY = Math.min(rim + MARKER_SHARE * (height - rim), height - MARKER_ABOVE_BOTTOM);
  // How far up the globe's face the marker is, from its middle.
  const up = clamp((y - markerY) / radius, -1, 1);
  return { width, height, x: width / 2, y, radius, latitude: latitude - (Math.asin(up) * 180) / Math.PI };
}

/** From a little east of `from`, the short way round, to a little east of
    `here`; from further off when `from` is close by. */
export function turnOf(here: Coordinates, from: Coordinates | undefined): Turn {
  const end = here[0] + ENDS_EAST_OF_HERE;
  const fromStart = from ? from[0] + STARTS_EAST_OF_FROM : end + TURN_WITHOUT_FROM;
  // From somewhere close by (a visitor in the same country), the globe
  // still turns: from as far off as it would with nowhere it's from.
  const isShort = Math.abs(turnTowards(fromStart, end) - fromStart) < SHORTEST_TURN;
  const start = isShort ? end + TURN_WITHOUT_FROM : fromStart;
  return { start, end: turnTowards(start, end) };
}

/** Where the turn is `ms` after it starts. */
export function momentAt(ms: number, { start, end }: Turn): Moment {
  return {
    longitude: start + (end - start) * easeInOut(clamp((ms - PLAY.turnStarts) / PLAY.turnMs)),
    drawn: clamp((ms - PLAY.wayStarts) / PLAY.wayMs),
    settled: clamp((ms - PLAY.lands) / PLAY.settleMs),
    shown: clamp(ms / PLAY.fadeMs),
  };
}
