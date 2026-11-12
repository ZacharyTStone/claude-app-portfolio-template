/* The diagrams (diagrams/*.ts, written to public/assets by `npm run
   diagrams`): the files are what the diagrams draw now, a picture is
   nothing but shapes and their motion, its still has no motion, and the
   config names both. And the kit they're drawn with (scripts/diagram.ts):
   how it writes motion over a loop, and what it leaves out of a still. */

import assert from "node:assert/strict";
import { test } from "node:test";
import config from "../site.config.ts";
import { box, group, loopOf, moving, onlyWhenMoving, svgOf, type Shape } from "../scripts/diagram.ts";
import { diagramFiles, staleDiagramFiles } from "../scripts/diagrams.ts";
import { ROOT } from "../src/site/constants.ts";
import { answerBlocksIn, picturesIn } from "../src/site/validate/blocks.ts";

/** Every file the diagrams make: its path from the repo's root, and its text. */
const files = await diagramFiles(ROOT);
/** A path in public/ as a page names it: "public/assets/a.svg" is "/assets/a.svg". */
const asThePageNamesIt = (path: string): string => path.replace(/\\/g, "/").replace(/^public/, "");
const STILL = /-still\.svg$/;

// ---- The site's diagrams -------------------------------------------------------

test("Every diagram's files are what it draws now", async () => {
  assert.deepEqual(await staleDiagramFiles(ROOT), [], 'Run "npm run diagrams" and commit what it writes');
});

test("A diagram is shapes and their motion: no script, no styles, no file of another's", () => {
  /** What a picture shown with <img>, under the page's policy, can't have
      or shouldn't need. */
  const notInAPicture = /<script|<style|\sstyle=|\sclass=|\shref=|<foreignObject|<image|<use|\son[a-z]+=|url\(/i;
  for (const [path, text] of files) {
    assert.doesNotMatch(text, notInAPicture, path);
  }
});

test("A diagram's still has no motion in it, and its moving picture has", () => {
  const motion = /<animate|<set\b/;
  for (const [path, text] of files) {
    if (STILL.test(path)) assert.doesNotMatch(text, motion, path);
    else assert.match(text, motion, path);
  }
});

test("A diagram the config shows comes with its still", () => {
  const diagrams = new Set([...files.keys()].map(asThePageNamesIt));
  for (const [code, language] of Object.entries(config.languages)) {
    for (const picture of answerBlocksIn(language).flatMap(picturesIn)) {
      if (!diagrams.has(picture.src) || STILL.test(picture.src)) continue;
      assert.equal(
        picture.still,
        picture.src.replace(/\.svg$/, "-still.svg"),
        `${code}: the picture "${picture.src}" moves, so it names its still`,
      );
    }
  }
});

// ---- The kit -------------------------------------------------------------------

/** The attributes of a motion the kit made. */
const attributesOf = (motion: Shape) => motion.attributes;

test("A track lasts the whole loop: held from its start to the first frame, and from the last to its end", () => {
  const loop = loopOf(10);
  const track = attributesOf(
    loop.track("opacity", [
      [2, 0],
      [4, 1],
    ]),
  );
  assert.equal(track.dur, "10s");
  assert.equal(track.repeatCount, "indefinite");
  assert.equal(track.values, "0;0;1;1");
  assert.equal(track.keyTimes, "0;0.2;0.4;1");
  // A value that steps holds without a last frame.
  const steps = attributesOf(loop.track("opacity", [[5, 1]], "steps"));
  assert.equal(steps.values, "1;1");
  assert.equal(steps.keyTimes, "0;0.5");
  assert.equal(steps.calcMode, "discrete");
});

test("A track refuses a frame outside the loop, or before the one it follows", () => {
  const loop = loopOf(10);
  assert.throws(() => loop.track("opacity", [[11, 1]]), /outside the loop's 10 s/);
  assert.throws(
    () =>
      loop.track("opacity", [
        [4, 1],
        [2, 0],
      ]),
    /comes before the one it follows/,
  );
});

test("The still picture is the same shapes without their motion, and without what only moves", () => {
  const loop = loopOf(10);
  const place = { x: 0, y: 0, width: 10, height: 10 };
  const drawing = {
    width: 100,
    height: 100,
    shapes: [moving(box(place), loop.shown(1, 2)), onlyWhenMoving(group({ id: "passing" }, box(place)))],
  };
  const movingPicture = svgOf(drawing, "moving");
  const still = svgOf(drawing, "still");
  assert.match(movingPicture, /<animate /);
  assert.match(movingPicture, /id="passing"/);
  assert.doesNotMatch(still, /<animate /);
  assert.doesNotMatch(still, /id="passing"/);
  assert.equal(still.match(/<rect /g)?.length, 2, "the ground and the box are both still there");
});
