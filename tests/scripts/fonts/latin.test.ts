/* The Latin serif (scripts/fonts/latin.ts): the shared file is cut to its set and its axes, and the stylesheet
   asks it for those characters and weights and no others. Nothing is downloaded. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import fontverter from "fontverter";
import { Blob, Face } from "harfbuzzjs";
import { LATIN_SERIF, LATIN_SERIF_CHARACTERS, LATIN_SERIF_RANGES } from "../../../scripts/fonts/latin.ts";
import { charactersIn } from "../../../scripts/fonts/subset.ts";
import { ROOT } from "../../../src/site/repo.ts";

const font = readFileSync(join(ROOT, LATIN_SERIF.file));
const fontsCss = readFileSync(join(ROOT, "src", "styles", "fonts.css"), "utf8");

/** The @font-face rule that loads the file. */
const fontFace = fontsCss
  .match(/@font-face\s*{[^}]*}/g)
  ?.find((rule) => rule.includes(LATIN_SERIF.file.split("/").pop() ?? ""));

/** A descriptor's value in the rule, as written: "400 900". */
const descriptor = (name: string): string => fontFace?.match(new RegExp(`\\b${name}:\\s*([^;]*);`))?.[1]?.trim() ?? "";

/** "U+0020-007E" as [0x20, 0x7e], and "U+0131" as [0x131, 0x131]. */
function rangeOf(written: string): [number, number] {
  const [first = "", last = first] = written.replace(/^U\+/i, "").split("-");
  return [parseInt(first, 16), parseInt(last, 16)];
}

test("the stylesheet has an @font-face rule for the Latin serif", () => {
  assert.ok(fontFace);
});

test("its unicode-range is the set the font is cut to, so it's asked for no character it hasn't", () => {
  const ranges = descriptor("unicode-range")
    .split(/\s*,\s*/)
    .map(rangeOf);
  assert.deepEqual(ranges, LATIN_SERIF_RANGES);
});

test("its weights are the range the font is cut to", () => {
  const { wght } = LATIN_SERIF.cut.axes;
  assert.ok(typeof wght === "object", "the font is cut to a range of weights");
  assert.equal(descriptor("font-weight"), `${wght.min} ${wght.max}`);
});

test("the shared file has every character of the set, and no other", async () => {
  assert.deepEqual([...(await charactersIn(font))].sort(), [...LATIN_SERIF_CHARACTERS].sort());
});

test("the shared file is variable over the weights and optical sizes it's cut to", async () => {
  const face = new Face(new Blob(await fontverter.convert(font, "truetype")));
  const axes = Object.entries(face.getAxisInfos()).map(([tag, { min, max }]) => [tag, { min, max }]);
  assert.deepEqual(Object.fromEntries(axes), LATIN_SERIF.cut.axes);
});
