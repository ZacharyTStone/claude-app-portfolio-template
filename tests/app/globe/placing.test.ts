/* Where the globe sits, and its turn (src/app/globe/placing.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { LANDS_MS, PLAY_MS, momentAt, placeGlobe, sparkAt, turnOf } from "../../../src/app/globe/placing.ts";
import { seenFrom, vectorOf, type Coordinates } from "../../../src/app/globe/sphere.ts";

const TOKYO: Coordinates = [139.69, 35.69];
const NEW_YORK: Coordinates = [-74.01, 40.71];
const [WIDTH, HEIGHT, TEXT_BOTTOM] = [774, 900, 565];

test("the globe's rim is a little under the text, and only its top shows", () => {
  const placing = placeGlobe(WIDTH, HEIGHT, TEXT_BOTTOM, TOKYO[1]);
  assert.ok(placing);
  const rim = placing.y - placing.radius;
  assert.ok(rim > TEXT_BOTTOM && rim < TEXT_BOTTOM + 80, `its rim is at ${rim}`);
  assert.ok(placing.y > HEIGHT);
});

test("there's no globe when the text leaves too little room under it", () => {
  assert.equal(placeGlobe(WIDTH, HEIGHT, HEIGHT - 120, TOKYO[1]), null);
});

test("the globe is seen from a latitude that puts its marker most of the way down what shows", () => {
  const placing = placeGlobe(WIDTH, HEIGHT, TEXT_BOTTOM, TOKYO[1]);
  assert.ok(placing);
  const { up } = seenFrom({ longitude: TOKYO[0], latitude: placing.latitude }, vectorOf(TOKYO));
  const markerY = placing.y - placing.radius * up;
  const rim = placing.y - placing.radius;
  assert.ok(markerY > rim + (HEIGHT - rim) / 2 && markerY < HEIGHT, `the marker is at ${markerY}`);
});

test("the turn starts a little east of where its owner is from, and ends a little east of where they are", () => {
  const { start, end } = turnOf(TOKYO, NEW_YORK);
  assert.ok(start > NEW_YORK[0] && start - NEW_YORK[0] < 20);
  const endsAt = ((end % 360) + 360) % 360;
  assert.ok(endsAt > TOKYO[0] && endsAt - TOKYO[0] < 20);
});

test("with nowhere it's from, the globe still turns to where its owner is", () => {
  const { start, end } = turnOf(TOKYO, undefined);
  assert.notEqual(start, end);
});

test("the turn starts faded out, facing where it starts, with nothing of the way drawn", () => {
  const turn = turnOf(TOKYO, NEW_YORK);
  assert.deepEqual(momentAt(0, turn), { longitude: turn.start, drawn: 0, settled: 0, shown: 0 });
});

test("the turn ends facing where its owner is, with the way drawn, after it has landed", () => {
  const turn = turnOf(TOKYO, NEW_YORK);
  assert.ok(LANDS_MS < PLAY_MS);
  assert.deepEqual(momentAt(PLAY_MS, turn), { longitude: turn.end, drawn: 1, settled: 1, shown: 1 });
});

test("once it has landed, a spark runs the way now and then: not at once, from its start to its end, then again", () => {
  assert.equal(sparkAt(0), undefined);
  const runs = Array.from({ length: 40_000 / 50 }, (_, step) => sparkAt(step * 50));
  const firstRun = runs.findIndex((spark) => spark !== undefined);
  assert.ok(firstRun > 0, "it waits a moment after landing");
  assert.ok((runs[firstRun] ?? 1) < 0.05, "it sets off from where the owner is from");
  const along = runs.slice(firstRun, runs.indexOf(undefined, firstRun));
  assert.deepEqual(
    along,
    [...along].sort((a = 0, b = 0) => a - b),
    "it only goes forward",
  );
  assert.ok((along.at(-1) ?? 0) > 0.95, "it arrives where the owner is");
  const startsOfRuns = runs.filter((spark, step) => spark !== undefined && runs[step - 1] === undefined).length;
  assert.ok(startsOfRuns >= 3, `it runs again: ${startsOfRuns} runs in 40 s`);
});
