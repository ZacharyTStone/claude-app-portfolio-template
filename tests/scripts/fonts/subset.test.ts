/* Cut from Inter, which every site has (public/assets/fonts is shared): it has a weight axis, and features
   besides the ones a cut keeps. Nothing is downloaded. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import fontverter from "fontverter";
import { Blob, Face } from "harfbuzzjs";
import { charactersIn, cutFont } from "../../../scripts/fonts/subset.ts";
import { ROOT } from "../../../src/site/constants.ts";

const inter = readFileSync(join(ROOT, "public", "assets", "fonts", "inter.woff2"));
const faceOf = async (font: Buffer): Promise<Face> => new Face(new Blob(await fontverter.convert(font, "truetype")));

const ASKED_FOR = ["A", "V", "é"];
const aRangeOfWeights = await cutFont(inter, ASKED_FOR, { min: 300, max: 700 });
const oneWeight = await cutFont(inter, ASKED_FOR, 400);

test("The characters a font has are read from its file", async () => {
  const has = await charactersIn(inter);
  assert.deepEqual([has.has("A"), has.has("あ")], [true, false]);
});

test("A cut font has the characters asked for, and no others", async () => {
  assert.deepEqual([...(await charactersIn(aRangeOfWeights))].sort(), [...ASKED_FOR].sort());
});

test("A cut font is smaller than the font it's cut from", () => {
  assert.ok(aRangeOfWeights.byteLength < inter.byteLength / 4);
});

test("The same cut is the same file, byte for byte", async () => {
  assert.deepEqual(await cutFont(inter, ASKED_FOR, { min: 300, max: 700 }), aRangeOfWeights);
});

test("A font cut to a range of weights is variable over that range", async () => {
  const { wght } = (await faceOf(aRangeOfWeights)).getAxisInfos();
  assert.deepEqual([wght?.min, wght?.max], [300, 700]);
});

test("A font cut to one weight isn't variable", async () => {
  assert.deepEqual((await faceOf(oneWeight)).getAxisInfos(), {});
});

test("A cut keeps kerning, and none of the features the site doesn't turn on", async () => {
  const face = await faceOf(aRangeOfWeights);
  const features = [...face.getTableFeatureTags("GPOS"), ...face.getTableFeatureTags("GSUB")];
  assert.deepEqual(new Set(features), new Set(["kern"]));
});
