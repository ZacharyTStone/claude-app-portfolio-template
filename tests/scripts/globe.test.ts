/* src/app/globe/land.ts is what `npm run globe` (scripts/globe.ts) writes. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { LAND_FILE, landFileText } from "../../scripts/globe.ts";

test("the globe's land is what `npm run globe` writes", () => {
  assert.equal(readFileSync(LAND_FILE, "utf8"), landFileText(), "run `npm run globe`");
});
