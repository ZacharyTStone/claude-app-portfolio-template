import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pictureMode } from "../../src/components/picture.ts";
import { PLAYS_ATTRIBUTE } from "../../src/contracts/picture-files.ts";

const site = mkdtempSync(join(tmpdir(), "picture-mode-"));
after(() => rmSync(site, { recursive: true, force: true }));
mkdirSync(join(site, "public", "assets"), { recursive: true });
writeFileSync(join(site, "public", "assets", "played.svg"), `<svg width="10" ${PLAYS_ATTRIBUTE}="6"></svg>`);
writeFileSync(join(site, "public", "assets", "map.svg"), `<svg width="10"></svg>`);

test("a picture without a still is shown as it is", () => {
  assert.deepEqual(pictureMode({ src: "/assets/played.svg" }, site), { kind: "plain" });
});

test("a picture whose file says how long it plays rests as its still, to be played", () => {
  const picture = { src: "/assets/played.svg", still: "/assets/played-still.svg" };
  assert.deepEqual(pictureMode(picture, site), { kind: "played", still: "/assets/played-still.svg", seconds: 6 });
});

test("a picture with a still whose file doesn't say moves all the time", () => {
  const picture = { src: "/assets/map.svg", still: "/assets/map-still.svg" };
  assert.deepEqual(pictureMode(picture, site), { kind: "moving", still: "/assets/map-still.svg" });
});
