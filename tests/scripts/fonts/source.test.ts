import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { NOTO_SANS_JP, NOTO_SERIF_JP, sourceFont, type SourceFont } from "../../../scripts/fonts/source.ts";

const SCRATCH = mkdtempSync(join(tmpdir(), "font-source-test-"));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

const THE_FONT = Buffer.from("the font");
const SOMETHING_ELSE = Buffer.from("something else");
const expected: SourceFont = {
  path: "ofl/some font/Some[wght].ttf",
  sha256: createHash("sha256").update(THE_FONT).digest("hex"),
};

/** A way to get a font that downloads `file`, and counts and remembers what it was asked for. */
function fetching(name: string, file: Buffer) {
  const asked: string[] = [];
  const download = (address: string) => {
    asked.push(address);
    return Promise.resolve(file);
  };
  return { cacheFolder: join(SCRATCH, name), download, asked };
}

test("A downloaded font that is the one expected is returned", async () => {
  assert.deepEqual(await sourceFont(expected, fetching("sound", THE_FONT)), THE_FONT);
});

test("A font is downloaded once, and kept for the next time", async () => {
  const how = fetching("kept", THE_FONT);
  await sourceFont(expected, how);
  assert.deepEqual(await sourceFont(expected, how), THE_FONT);
  assert.equal(how.asked.length, 1);
});

test("A download that isn't the font expected is refused, and not kept", async () => {
  const how = fetching("wrong", SOMETHING_ELSE);
  await assert.rejects(sourceFont(expected, how), /isn't the font this script expects .* nothing was written/);
  assert.equal(existsSync(how.cacheFolder), false);
});

test("A kept file that isn't the font expected is downloaded again", async () => {
  const how = fetching("spoiled", THE_FONT);
  await sourceFont(expected, how);
  for (const kept of readdirSync(how.cacheFolder)) writeFileSync(join(how.cacheFolder, kept), SOMETHING_ELSE);
  assert.deepEqual(await sourceFont(expected, how), THE_FONT);
  assert.equal(how.asked.length, 2);
});

test("A font's address names a commit of Google's fonts, never a branch, with its path made safe", async () => {
  const how = fetching("address", THE_FONT);
  await sourceFont(expected, how);
  assert.match(
    how.asked[0] ?? "",
    /^https:\/\/raw\.githubusercontent\.com\/google\/fonts\/[0-9a-f]{40}\/ofl\/some%20font\/Some%5Bwght%5D\.ttf$/,
  );
});

test("Each of the site's two source fonts says which file it has to be", () => {
  for (const font of [NOTO_SANS_JP, NOTO_SERIF_JP]) assert.match(font.sha256, /^[0-9a-f]{64}$/, font.path);
});
