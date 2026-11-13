import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { box, group, loopOf, moving, onlyWhenMoving, svgOf, type Drawing } from "../../../scripts/diagram.ts";
import { PLAYS_ATTRIBUTE } from "../../../src/contracts/picture-files.ts";
import { secondsPlayed } from "../../../src/site/pictures.ts";
import { aBox, pictureOf } from "./helpers.ts";

const A_PLACE = { x: 0, y: 0, width: 10, height: 10 };
const movingAndPassing = [
  moving(box(A_PLACE), loopOf(10).shown(1, 2)),
  onlyWhenMoving(group({ id: "passing" }, box(A_PLACE))),
];

test("The moving picture has its shapes' motion, and what's only there while it moves", () => {
  const movingPicture = pictureOf(movingAndPassing, "moving");
  assert.match(movingPicture, /<animate /);
  assert.match(movingPicture, /id="passing"/);
});

test("The still picture is the same shapes without their motion, and without what only moves", () => {
  const still = pictureOf(movingAndPassing, "still");
  assert.doesNotMatch(still, /<animate /);
  assert.doesNotMatch(still, /id="passing"/);
  assert.equal(still.match(/<rect /g)?.length, 2, "the ground and the box are both still there");
});

const played: Drawing = { width: 100, height: 100, plays: 8.25, shapes: [aBox()] };

test("A picture that's played says for how long on its moving file", () => {
  assert.match(svgOf(played, "moving"), new RegExp(`^<svg [^>]* ${PLAYS_ATTRIBUTE}="8.25">`));
});

test("A still picture doesn't say it's played, nor does one that isn't", () => {
  assert.doesNotMatch(svgOf(played, "still"), new RegExp(PLAYS_ATTRIBUTE), "the still isn't played");
  assert.doesNotMatch(pictureOf([aBox()], "moving"), new RegExp(PLAYS_ATTRIBUTE), "nor is one that doesn't say");
});

/** A site whose public folder has the played picture's two files, as the build finds them. */
const site = mkdtempSync(join(tmpdir(), "pictures-"));
after(() => rmSync(site, { recursive: true, force: true }));
mkdirSync(join(site, "public", "assets"), { recursive: true });
writeFileSync(join(site, "public", "assets", "played.svg"), svgOf(played, "moving"));
writeFileSync(join(site, "public", "assets", "played-still.svg"), svgOf(played, "still"));
writeFileSync(join(site, "public", "assets", "photo.webp"), "");

test("The build reads how long a picture plays from the file the kit wrote", () => {
  assert.equal(secondsPlayed("/assets/played.svg", site), 8.25);
});

test("The build finds nothing played in a still, in another kind of file, or where there's no file", () => {
  assert.equal(secondsPlayed("/assets/played-still.svg", site), undefined);
  assert.equal(secondsPlayed("/assets/photo.webp", site), undefined, "only an SVG file says");
  assert.equal(secondsPlayed("/assets/missing.svg", site), undefined, "a file that isn't there says nothing");
});
