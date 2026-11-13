/* The site's own diagrams (diagrams/*.ts) and the files `npm run diagrams` writes from them. The kit they're
   drawn with has its tests in tests/scripts/diagram/. */

import assert from "node:assert/strict";
import { test } from "node:test";
import config from "../site.config.ts";
import { diagramFiles, staleDiagramFiles } from "../scripts/diagrams.ts";
import { ROOT } from "../src/site/repo.ts";
import { secondsPlayed } from "../src/components/picture.ts";
import { answerBlocksIn, picturesIn } from "../src/config/blocks.ts";

const STILL = /-still\.svg$/;
const stillOf = (src: string): string => src.replace(/\.svg$/, "-still.svg");
/** A path in public/ as a page names it: "public/assets/a.svg" is "/assets/a.svg". */
const asThePageNamesIt = (path: string): string => path.replace(/\\/g, "/").replace(/^public/, "");

/** Every file the diagrams make: its path from the repo's root, and its text. */
const files = await diagramFiles(ROOT);
const movingFiles = [...files].filter(([path]) => !STILL.test(path));
const stillFiles = [...files].filter(([path]) => STILL.test(path));
/** The moving files a visitor plays, with for how many seconds, as the build reads it. */
const playedFiles = movingFiles.flatMap(([path, text]) => {
  const plays = secondsPlayed(asThePageNamesIt(path), ROOT);
  return plays === undefined ? [] : [{ path, text, plays }];
});

test("Every diagram's files are what it draws now", async () => {
  assert.deepEqual(await staleDiagramFiles(ROOT), [], 'Run "npm run diagrams" and commit what it writes');
});

test("A diagram is shapes and their motion: no script, no styles, no file of another's", () => {
  // A `url(` may only point inside the picture itself (`url(#its-clip)`), never at a file.
  const notInAPicture = /<script|<style|\sstyle=|\sclass=|\shref=|<foreignObject|<image|<use|\son[a-z]+=|url\((?!#)/i;
  for (const [path, text] of files) assert.doesNotMatch(text, notInAPicture, path);
});

const MOTION = /<animate|<set\b/;

test("A diagram's moving picture has motion in it", () => {
  for (const [path, text] of movingFiles) assert.match(text, MOTION, path);
});

test("A diagram's still has no motion in it", () => {
  for (const [path, text] of stillFiles) assert.doesNotMatch(text, MOTION, path);
});

test("A diagram the config shows comes with its still", () => {
  const diagrams = new Set(movingFiles.map(([path]) => asThePageNamesIt(path)));
  for (const [code, language] of Object.entries(config.languages)) {
    const shown = answerBlocksIn(language)
      .flatMap(picturesIn)
      .filter((picture) => diagrams.has(picture.src));
    for (const picture of shown)
      assert.equal(
        picture.still,
        stillOf(picture.src),
        `${code}: the picture "${picture.src}" moves, so it names its still`,
      );
  }
});

test("A diagram that's played plays for a time inside its loop", () => {
  for (const { path, text, plays } of playedFiles) {
    const loopSeconds = Number(/ dur="([0-9.]+)s"/.exec(text)?.[1]);
    assert.ok(plays > 0 && plays <= loopSeconds, `${path} plays for ${plays} s of a loop of ${loopSeconds} s`);
  }
});

test("A played diagram's still isn't played", () => {
  for (const { path } of playedFiles)
    assert.equal(secondsPlayed(stillOf(asThePageNamesIt(path)), ROOT), undefined, `${path}'s still isn't played`);
});
