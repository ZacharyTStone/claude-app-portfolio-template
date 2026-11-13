/* The icons a config can name, and the stylesheet they're read from (src/site/icons.ts). */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { BADGES } from "../../src/components/logos.ts";
import { LOGO_NAMES, readStylesheet, STYLES_FOLDER } from "../../src/site/icons.ts";
import { ROOT } from "../../src/site/repo.ts";

test("the logos a config can name are the ones the page draws a badge for", () => {
  assert.deepEqual([...LOGO_NAMES], [...BADGES.keys()]);
});

/** A url(…) in the stylesheet, quoted or not; its second group is the address. */
const CSS_URL = /url\((["']?)([^"')]+)\1\)/g;
const addressesInTheStylesheet = [...readStylesheet(join(ROOT, STYLES_FOLDER)).matchAll(CSS_URL)].map(
  ([, , address = ""]) => address,
);

test("the stylesheet names files by their address", () => {
  assert.ok(addressesInTheStylesheet.length > 0);
});

test("the stylesheet's addresses start at the site's root", () => {
  assert.deepEqual(
    addressesInTheStylesheet.filter((address) => !/^\/(?!\/)/.test(address)),
    [],
  );
});

test("the stylesheet's addresses name files that are in public/", () => {
  assert.deepEqual(
    addressesInTheStylesheet.filter((address) => !existsSync(join(ROOT, "public", address))),
    [],
  );
});
