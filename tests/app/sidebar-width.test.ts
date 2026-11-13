import assert from "node:assert/strict";
import { test } from "node:test";
import { edgeStepFor, rememberedWidth, SIDEBAR_WIDTH, widestIn, widthWithin } from "../../src/app/sidebar-width.ts";

const { narrowest, widest, roomForTheRest, arrowKeyStep } = SIDEBAR_WIDTH;
const A_WIDE_WINDOW = 1440;

test("in a wide window the sidebar can be its widest", () => {
  assert.equal(widestIn(A_WIDE_WINDOW), widest);
});

test("in a narrower window the sidebar leaves the rest its room", () => {
  assert.equal(widestIn(roomForTheRest + 300), 300);
});

test("in a window too narrow for that room the sidebar is still its narrowest", () => {
  assert.equal(widestIn(roomForTheRest), narrowest);
});

test("a width within the limits is kept", () => {
  assert.equal(widthWithin(300, A_WIDE_WINDOW), 300);
});

test("a width under the narrowest is the narrowest", () => {
  assert.equal(widthWithin(10, A_WIDE_WINDOW), narrowest);
});

test("a width over the widest is the widest", () => {
  assert.equal(widthWithin(2000, A_WIDE_WINDOW), widest);
});

test("a width over what the window leaves is what the window leaves", () => {
  assert.equal(widthWithin(450, roomForTheRest + 300), 300);
});

test("a width is in whole pixels", () => {
  assert.equal(widthWithin(300.6, A_WIDE_WINDOW), 301);
});

test("the left arrow narrows the sidebar by a step", () => {
  assert.equal(edgeStepFor("ArrowLeft"), -arrowKeyStep);
});

test("the right arrow widens the sidebar by a step", () => {
  assert.equal(edgeStepFor("ArrowRight"), arrowKeyStep);
});

test("any other key moves nothing", () => {
  assert.equal(edgeStepFor("ArrowUp"), 0);
});

test("a saved width is remembered", () => {
  assert.equal(rememberedWidth("312"), 312);
});

for (const [what, saved] of [
  ["nothing saved", null],
  ["the empty text saved for the stylesheet's own width", ""],
  ["text that isn't a number", "wide"],
  ["a width of nothing", "0"],
  ["a width below nothing", "-40"],
] as const) {
  test(`${what} is no width to remember`, () => {
    assert.equal(rememberedWidth(saved), null);
  });
}
