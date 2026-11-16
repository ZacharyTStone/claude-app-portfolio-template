import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isMostlyOnScreen,
  MOSTLY_ON_SCREEN,
  SHARES_TO_TELL,
  takingTurns,
  type Sighting,
} from "../../src/app/play-turns.ts";

/** Two pictures, as the page's figures would be. */
type Picture = { name: string };
const MAP: Picture = { name: "map" };
const FLOW: Picture = { name: "flow" };

const A_SCREEN = { height: 900 };
const A_PICTURE_HEIGHT = 300;

/** How the browser sees a picture `pictureHeight` tall with `share` of it on
    a screen as tall as `screen`. */
function sighting(share: number, screen: { height: number } | null = A_SCREEN, pictureHeight = A_PICTURE_HEIGHT) {
  return {
    isIntersecting: share > 0,
    intersectionRatio: share,
    intersectionRect: { height: share * pictureHeight },
    rootBounds: screen,
  } satisfies Sighting;
}

test("the browser says when a picture comes on screen, when it leaves, and when most of it is on screen", () => {
  assert.ok(SHARES_TO_TELL.includes(0));
  assert.ok(SHARES_TO_TELL.includes(MOSTLY_ON_SCREEN));
});

test("a picture most of which is on screen is mostly on screen", () => {
  assert.equal(isMostlyOnScreen(sighting(MOSTLY_ON_SCREEN)), true);
});

test("a picture whole on screen is mostly on screen", () => {
  assert.equal(isMostlyOnScreen(sighting(1)), true);
});

test("a picture only half on screen isn't", () => {
  assert.equal(isMostlyOnScreen(sighting(0.5)), false);
});

test("a picture none of which is on screen isn't, such as one in a tab that isn't open", () => {
  assert.equal(isMostlyOnScreen(sighting(0)), false);
});

test("a picture too tall to show most of is mostly on screen once it fills most of the screen", () => {
  const tooTall = A_SCREEN.height * 2;
  assert.equal(isMostlyOnScreen(sighting(MOSTLY_ON_SCREEN / 2, A_SCREEN, tooTall)), true);
});

test("a picture too tall to show most of isn't mostly on screen while it fills less of the screen", () => {
  const tooTall = A_SCREEN.height * 2;
  assert.equal(isMostlyOnScreen(sighting(MOSTLY_ON_SCREEN / 4, A_SCREEN, tooTall)), false);
});

test("without the screen's size, only the share of the picture counts", () => {
  const tooTall = A_SCREEN.height * 2;
  assert.equal(isMostlyOnScreen(sighting(MOSTLY_ON_SCREEN / 2, null, tooTall)), false);
});

test("at first, no picture's turn has come", () => {
  assert.equal(takingTurns<Picture>().next(), undefined);
});

test("a picture that comes mostly on screen has its turn", () => {
  const turns = takingTurns<Picture>();
  turns.seen(MAP, true);
  assert.equal(turns.next(), MAP);
});

test("a picture only partly on screen waits", () => {
  const turns = takingTurns<Picture>();
  turns.seen(MAP, false);
  assert.equal(turns.next(), undefined);
});

test("a picture keeps its turn until it has had it", () => {
  const turns = takingTurns<Picture>();
  turns.seen(MAP, true);
  turns.next();
  assert.equal(turns.next(), MAP);
});

test("a picture that has had its turn never has another, whenever it's back on screen", () => {
  const turns = takingTurns<Picture>();
  turns.seen(MAP, true);
  turns.taken(MAP);
  turns.seen(MAP, false);
  turns.seen(MAP, true);
  assert.equal(turns.next(), undefined);
});

test("a picture pressed before it comes on screen has had its turn", () => {
  const turns = takingTurns<Picture>();
  turns.taken(MAP);
  turns.seen(MAP, true);
  assert.equal(turns.next(), undefined);
});

test("of two on screen together, the one that came first has the first turn, and the other the next", () => {
  const turns = takingTurns<Picture>();
  turns.seen(MAP, true);
  turns.seen(FLOW, true);
  assert.equal(turns.next(), MAP);
  turns.taken(MAP);
  assert.equal(turns.next(), FLOW);
});

test("a picture that waited, and left the screen before its turn came, waits for its next time on screen", () => {
  const turns = takingTurns<Picture>();
  turns.seen(FLOW, true);
  turns.seen(FLOW, false);
  assert.equal(turns.next(), undefined);
  turns.seen(FLOW, true);
  assert.equal(turns.next(), FLOW);
});

test("a picture back on screen goes after those that waited there while it was away", () => {
  const turns = takingTurns<Picture>();
  turns.seen(MAP, true);
  turns.seen(FLOW, true);
  turns.seen(MAP, false);
  turns.seen(MAP, true);
  assert.equal(turns.next(), FLOW);
});
