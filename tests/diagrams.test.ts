/* The diagrams (diagrams/*.ts, written to public/assets by `npm run
   diagrams`): the files are what the diagrams draw now, a picture is
   nothing but shapes and their motion, its still has no motion, and the
   config names both. And the kit they're drawn with (scripts/diagram.ts):
   where it puts shapes, how it writes motion over a loop, what a story's
   loop keeps until it clears, and what it leaves out of a still. */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import config from "../site.config.ts";
import {
  aroundOrigin,
  box,
  centreOf,
  COLOR,
  dot,
  group,
  label,
  loopOf,
  moving,
  onlyWhenMoving,
  placed,
  PLAYS_ATTRIBUTE,
  sizeToFit,
  svgOf,
  textWidth,
  type Drawing,
  type Shape,
} from "../scripts/diagram.ts";
import { diagramFiles, staleDiagramFiles } from "../scripts/diagrams.ts";
import { ROOT } from "../src/site/repo.ts";
import { PLAYS_ATTRIBUTE as PLAYS_ATTRIBUTE_THE_PAGE_READS, secondsPlayed } from "../src/site/pictures.ts";
import { answerBlocksIn, picturesIn } from "../src/config/blocks.ts";

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
      or shouldn't need. A `url(` may only point inside the picture itself
      (`url(#its-clip)`), never at a file. */
  const notInAPicture = /<script|<style|\sstyle=|\sclass=|\shref=|<foreignObject|<image|<use|\son[a-z]+=|url\((?!#)/i;
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

test("A diagram that says how long it plays says a time inside its loop, and the build reads it from its file", () => {
  for (const [path, text] of files) {
    if (STILL.test(path)) continue;
    const plays = secondsPlayed(asThePageNamesIt(path), ROOT);
    if (plays === undefined) continue;
    const loopSeconds = Number(/ dur="([0-9.]+)s"/.exec(text)?.[1]);
    assert.ok(plays > 0 && plays <= loopSeconds, `${path} plays for ${plays} s of a loop of ${loopSeconds} s`);
    assert.equal(
      secondsPlayed(asThePageNamesIt(path).replace(/\.svg$/, "-still.svg"), ROOT),
      undefined,
      `${path}'s still isn't played`,
    );
  }
});

// ---- The kit -------------------------------------------------------------------

/** The attributes of a motion the kit made. */
const attributesOf = (motion: Shape) => motion.attributes;
/** The motions a shape has on it, in order. */
const motionsOn = (target: Shape) =>
  target.children.flatMap((child) => (typeof child !== "string" && /^animate|^set$/.test(child.tag) ? [child] : []));
/** A picture of these shapes, as a file's text. */
const pictureOf = (shapes: Shape[], how: "moving" | "still") =>
  svgOf({ width: 100, height: 100, shapes } satisfies Drawing, how);
/** A box to put motion on, or to carry. */
const aBox = () => box(aroundOrigin(10, 6));

test("A shape that's placed is drawn around (0, 0), in a group moved to its point", () => {
  assert.deepEqual(aroundOrigin(10, 6), { x: -5, y: -3, width: 10, height: 6 });
  assert.deepEqual(centreOf(aroundOrigin(10, 6)), { x: 0, y: 0 });
  // A point that's worked out is written rounded, as every number in a file is.
  assert.equal(placed({ x: 100 / 3, y: 20 }, aBox()).attributes.transform, "translate(33.33 20)");
});

test("Bold text is counted wider than regular, and text is made smaller only to fit", () => {
  const words = "A line of some words";
  const regular = textWidth(words, 40);
  assert.ok(textWidth(words, 40, false, 600) > regular, "semibold is wider");
  assert.equal(textWidth(words, 40, false, 500), regular, "medium is counted as regular");
  assert.equal(textWidth(words, 40, true, 600), textWidth(words, 40, true), "a monospaced font's bold is no wider");
  assert.equal(sizeToFit(words, regular + 1, 40), 40, "it fits as it is");
  const smaller = sizeToFit(words, regular / 2, 40);
  assert.equal(smaller, 20);
  assert.ok(textWidth(words, smaller) <= regular / 2, "at the smaller size it fits");
  assert.ok(sizeToFit(words, regular / 2, 40, { weight: 600 }) < smaller, "bold has to be smaller still");
});

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

test("Movement along a path eases, unless it's asked to keep one speed", () => {
  const loop = loopOf(10);
  const eased = attributesOf(loop.along("M0 0 L10 0", 2, 4));
  assert.equal(eased.calcMode, "spline");
  assert.equal(eased.keyTimes, "0;0.2;0.4;1");
  assert.equal(eased.keyPoints, "0;0;1;1");
  const even = attributesOf(loop.along("M0 0 L10 0", 2, 4, false, "even"));
  assert.equal(even.calcMode, "linear");
  assert.equal(even.keySplines, undefined);
  assert.equal(even.keyTimes, eased.keyTimes);
  assert.equal(attributesOf(loop.along("M0 0 L10 0", 2, 4, true, "even")).keyPoints, "1;1;0;0", "and back");
});

test("What's carried along a path is there only while it's carried", () => {
  const loop = loopOf(10);
  const carried = loop.carried(aBox(), "M0 0 L10 0", 2, 4);
  assert.equal(carried.onlyWhenMoving, true);
  assert.equal(carried.attributes.opacity, 0, "it rests out of sight");
  const [fades, moves] = motionsOn(carried).map(attributesOf);
  // It comes as it sets off, and goes as it arrives.
  assert.equal(fades?.values, "0;0;1;1;0;0");
  assert.equal(fades?.keyTimes, "0;0.1999;0.215;0.395;0.415;1");
  assert.equal(moves?.path, "M0 0 L10 0");
  assert.equal(moves?.calcMode, "spline");
  // What it's told about its way and its going, it does.
  const [earlier, evenly] = motionsOn(
    loop.carried([aBox(), aBox()], "M0 0 L10 0", 2, 4, { back: true, pace: "even", fadesBefore: 1 }),
  ).map(attributesOf);
  assert.equal(earlier?.keyTimes, "0;0.1999;0.215;0.3;0.415;1");
  assert.equal(evenly?.keyPoints, "1;1;0;0");
  assert.equal(evenly?.calcMode, "linear");
  assert.doesNotMatch(pictureOf([carried], "still"), /<g/, "and the still picture doesn't have it");
});

test("A flash or a ripple with no times does nothing", () => {
  const loop = loopOf(10);
  assert.equal(attributesOf(loop.flash([])).values, "0;0");
  assert.deepEqual(motionsOn(loop.ripple({ x: 0, y: 0 }, [])), []);
});

test("A flash or a ripple that starts before the one before it is over says so, and what to do", () => {
  const loop = loopOf(10);
  assert.throws(
    () => loop.flash([1, 1.5]),
    /The flash at 1\.5 s starts before the one at 1 s is over \(it lasts 0\.7 s\): give it a shorter `fall`/,
  );
  assert.doesNotThrow(() => loop.flash([1, 1.5], { fall: 0.4 }));
  assert.throws(
    () => loop.ripple({ x: 0, y: 0 }, [1, 1.5]),
    /The ripple at 1\.5 s starts before the one at 1 s is over \(it lasts 0\.9 s\): give each a ripple of its own/,
  );
  assert.doesNotThrow(() => [1, 1.5].map((time) => loop.ripple({ x: 0, y: 0 }, [time])));
});

test("A light is its overlay, out of sight but for its flashes, and an edge's light is a box's outline", () => {
  const loop = loopOf(10);
  const place = { x: 10, y: 20, width: 30, height: 40 };
  const light = loop.light(box(place, { fill: COLOR.accent, line: "none" }), [2], { peak: 0.4 });
  assert.equal(light.onlyWhenMoving, true);
  assert.equal(light.attributes.opacity, 0);
  assert.equal(light.attributes.fill, COLOR.accent);
  assert.equal(motionsOn(light).map(attributesOf)[0]?.values, "0;0;0.4;0;0");
  const edge = loop.edgeLight(place, [2], { radius: 30 });
  assert.equal(edge.onlyWhenMoving, true);
  assert.equal(edge.attributes.fill, "none");
  assert.equal(edge.attributes.rx, 30);
  assert.equal(edge.attributes.x, place.x);
  assert.doesNotThrow(() => loop.edgeLight(place, []), "nothing arrives: nothing lights");
});

test("Text that changes rests on its first text, or on its last when the picture ends on that", () => {
  const loop = loopOf(10);
  const texts = (rests: "first" | "last" | undefined, how: "moving" | "still") =>
    pictureOf(
      [
        loop.changing(
          "one",
          [
            [2, "two"],
            [4, "three"],
          ],
          (text) => label(text, { x: 0, y: 0 }),
          rests,
        ),
      ],
      how,
    );
  assert.match(texts(undefined, "still"), />one</);
  assert.doesNotMatch(texts(undefined, "still"), />two<|>three</);
  assert.match(texts("last", "still"), />three</);
  assert.doesNotMatch(texts("last", "still"), />one<|>two</);
  // Moving, every text is there, each shown in its turn whichever it rests on.
  for (const rests of ["first", "last"] as const) {
    const all = texts(rests, "moving");
    assert.match(all, />one<animate [^>]*values="1;0"[^>]*keyTimes="0;0.2"/);
    assert.match(all, />two<animate [^>]*values="0;1;0"[^>]*keyTimes="0;0.2;0.4"/);
    assert.match(all, />three<animate [^>]*values="0;1"[^>]*keyTimes="0;0.4"/);
  }
});

test("A story's loop: what comes stays until the loop clears, and what it starts with comes back out of sight", () => {
  const loop = loopOf(10, { from: 8, to: 9 });
  const since = attributesOf(loop.since(2, 0.5));
  assert.equal(since.values, "0;0;1;1;0;0");
  assert.equal(since.keyTimes, "0;0.2;0.25;0.8;0.9;1");
  // What the loop starts with comes as fast as the loop clears.
  const fromTheStart = attributesOf(loop.fromTheStart());
  assert.equal(fromTheStart.values, "0;1;1;0;0");
  assert.equal(fromTheStart.keyTimes, "0;0.1;0.8;0.9;1");
  // What something else brings in is only taken away.
  const untilClear = attributesOf(loop.untilClear());
  assert.equal(untilClear.values, "1;1;0;0");
  assert.equal(untilClear.keyTimes, "0;0.8;0.9;1");
  // What comes last is there by the time the loop starts to clear, and
  // nothing comes after that.
  assert.equal(attributesOf(loop.since(7.9, 0.5)).keyTimes, "0;0.79;0.8;0.8;0.9;1");
  assert.throws(() => loop.since(8.5), /comes at 8\.5 s comes after the loop has started to clear, at 8 s/);
});

test("A loop clears just before it ends unless it's told when, and refuses a time outside itself", () => {
  const { clears } = loopOf(10);
  assert.ok(clears.from > 9 && clears.from < clears.to && clears.to < 10, "its last second");
  assert.deepEqual(loopOf(10, { from: 7, to: 8 }).clears, { from: 7, to: 8 });
  assert.throws(() => loopOf(10, { from: 9, to: 11 }), /can't clear from 9 s to 11 s/);
  assert.throws(() => loopOf(10, { from: 9, to: 8 }), /can't clear from 9 s to 8 s/);
});

test("What pops, rises or glides into place rests there in the still picture", () => {
  const loop = loopOf(10);
  const shapes = [
    loop.popping(aBox(), { x: 30, y: 40 }, 2),
    loop.rising(box({ x: 1, y: 2, width: 3, height: 4 }), 3),
    loop.gliding(dot({ x: 0, y: 0 }, 5), { x: 10, y: 20 }, { x: 60, y: 70 }, { from: 4, to: 5 }),
  ];
  const still = pictureOf(shapes, "still");
  assert.match(still, /<g transform="translate\(30 40\)"><g><rect x="-5" y="-3"/, "what popped is at its point");
  assert.match(still, /<g><rect x="1" y="2"/, "what rose is where it was drawn");
  assert.match(still, /<g transform="translate\(60 70\)"><g><circle cx="0" cy="0"/, "what glided is where it went");
  const movingPicture = pictureOf(shapes, "moving");
  assert.match(movingPicture, /<animateTransform [^>]*type="scale"[^>]*values="0;0;1\.16;1;1"/);
  assert.match(movingPicture, /<animateTransform [^>]*type="translate"[^>]*values="0 16;0 16;0 0;0 0"/);
  // The glide is written from where it ends: it starts 50 back and 50 up.
  assert.match(movingPicture, /<animateMotion path="M-50 -50 Q[^"]* 0 0"/);
  // Each comes at its moment, and all go together as the loop clears.
  const opacity = [...movingPicture.matchAll(/attributeName="opacity"[^>]*keyTimes="([^"]*)"/g)].map(
    (match) => match[1],
  );
  assert.equal(opacity.length, 3);
  for (const keyTimes of opacity) assert.match(keyTimes ?? "", /;0\.91;0\.955;1$/);
});

test("A picture that's played says for how long on its moving file, where the build reads it", () => {
  assert.equal(PLAYS_ATTRIBUTE, PLAYS_ATTRIBUTE_THE_PAGE_READS, "the kit writes it where the build looks for it");
  const played: Drawing = { width: 100, height: 100, plays: 8.25, shapes: [aBox()] };
  assert.match(svgOf(played, "moving"), new RegExp(`^<svg [^>]* ${PLAYS_ATTRIBUTE}="8.25">`));
  assert.doesNotMatch(svgOf(played, "still"), new RegExp(PLAYS_ATTRIBUTE), "the still isn't played");
  assert.doesNotMatch(pictureOf([aBox()], "moving"), new RegExp(PLAYS_ATTRIBUTE), "nor is one that doesn't say");

  // As the build reads it: from the site's public folder, by the picture's path.
  const site = mkdtempSync(join(tmpdir(), "pictures-"));
  try {
    mkdirSync(join(site, "public", "assets"), { recursive: true });
    writeFileSync(join(site, "public", "assets", "played.svg"), svgOf(played, "moving"));
    writeFileSync(join(site, "public", "assets", "played-still.svg"), svgOf(played, "still"));
    writeFileSync(join(site, "public", "assets", "photo.webp"), "");
    assert.equal(secondsPlayed("/assets/played.svg", site), 8.25);
    assert.equal(secondsPlayed("/assets/played-still.svg", site), undefined);
    assert.equal(secondsPlayed("/assets/photo.webp", site), undefined, "only an SVG file says");
    assert.equal(secondsPlayed("/assets/missing.svg", site), undefined, "a file that isn't there says nothing");
  } finally {
    rmSync(site, { recursive: true, force: true });
  }
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
