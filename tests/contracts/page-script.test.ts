/* The page's script (dist/, after `npm run build`) has none of the
   contracts' schemas in it. The browser code imports the types and the
   plain checks from src/contracts, and the bundler drops the schemas it
   never uses: this fails when a change makes it keep them, which costs
   every visitor a schema library. */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { OUTPUT, ROOT } from "../../src/site/constants.ts";

/** Where Astro writes the scripts it bundles. */
const BUILT_SCRIPTS_FOLDER = join(ROOT, OUTPUT, "_astro");

/** What every schema carries: the name of the library that made it. */
const SCHEMA_LIBRARY_MARK = "valibot";

const builtScripts = existsSync(BUILT_SCRIPTS_FOLDER)
  ? readdirSync(BUILT_SCRIPTS_FOLDER).filter((file) => file.endsWith(".js"))
  : [];

test("the site is built, with a script for its pages", () => {
  assert.notEqual(builtScripts.length, 0, `no script in ${OUTPUT}/_astro: run \`npm run build\` first`);
});

for (const script of builtScripts) {
  test(`${script} has no schema in it`, () => {
    assert.equal(readFileSync(join(BUILT_SCRIPTS_FOLDER, script), "utf8").includes(SCHEMA_LIBRARY_MARK), false);
  });
}
