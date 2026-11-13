/* Builds the sample site (tests/sample/site.config.ts) into a temporary
   folder, as SITE_CONFIG lets anyone do, and checks what the repo's own
   site may not show: a site under a path, in two languages, on a host that
   reads no headers, with a viewer and a picture that has a still. */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { escapeRegExp } from "es-toolkit";
import { DATA, REDUCED_MOTION } from "../../src/contracts/page-attributes.ts";
import { HEADERS_FILE, pagePolicy } from "../../src/site/files/headers-file.ts";
import { FAVICONS } from "../../src/site/icons.ts";
import { frameOrigins } from "../../src/site/security-headers.ts";
import { makeSite } from "../../src/site/site.ts";
import sampleConfig from "../sample/site.config.ts";
import { astroBuild } from "./astro-build.ts";
import { builtSite, testBuiltSite } from "./built-site.ts";

/** The folder the sample is built into, removed once the tests are done. */
const BUILD_FOLDER = mkdtempSync(join(tmpdir(), "sample-site-"));
after(() => rmSync(BUILD_FOLDER, { recursive: true, force: true }));

const built = astroBuild(fileURLToPath(new URL("../sample/site.config.ts", import.meta.url)), BUILD_FOLDER);

const sample = builtSite("the sample site", BUILD_FOLDER, sampleConfig);
const policy = pagePolicy(makeSite(sampleConfig));

test("the sample site builds", () => {
  assert.equal(built.status, 0, built.stderr || built.stdout);
});

test("the sample site has a page for each of its two languages, and a 404 page", () => {
  assert.deepEqual(
    sample.pages.map(({ file }) => [file, sample.hasFile(file)]),
    [
      ["index.html", true],
      ["fr/index.html", true],
      ["404.html", true],
    ],
  );
});

testBuiltSite(sample);

/** The tags in a page's <head>, in order, as written. */
function headTagsOf(html: string): string[] {
  const head = html.match(/<head>(.*?)<\/head>/s)?.[1] ?? "";
  return [...head.matchAll(/<[a-z][^>]*>/g)].map(([tag]) => tag);
}

test("the sample's host reads no _headers file, so the build writes none and each page carries the policy", () => {
  assert.ok(policy);
  assert.ok(!sample.hasFile(HEADERS_FILE));
});

for (const { file } of sample.pages) {
  test(`${file} carries the policy right after its charset and viewport, before anything the policy covers`, () => {
    const headTags = headTagsOf(sample.read(file));
    assert.match(headTags[0] ?? "", /^<meta charset=/);
    assert.match(headTags[1] ?? "", /^<meta name="viewport"/);
    assert.equal(headTags[2], `<meta http-equiv="Content-Security-Policy" content="${policy}">`);
    assert.ok(headTags.findIndex((tag) => tag.startsWith("<link")) > 2, "a <link> comes before the policy");
  });
}

const frameAddresses = Object.values(sampleConfig.viewer ?? {});

test("the page's policy lets frames come from the viewer's site and no other", () => {
  assert.ok(frameAddresses.length, "the sample has a viewer");
  assert.match(policy ?? "", new RegExp(`(^|; )frame-src ${frameOrigins(sampleConfig.viewer).join(" ")}(;|$)`));
});

for (const { file } of sample.languagePages) {
  test(`${file} marks the link the viewer opens with the address it shows`, () => {
    const html = sample.read(file);
    const unmarked = frameAddresses.filter((address) => !html.includes(`${DATA.viewerAddress}="${address}"`));
    assert.deepEqual(unmarked, []);
  });

  test(`${file} offers a picture's still to a visitor who wants less motion, ahead of the moving one`, () => {
    const still = makeSite(sampleConfig).link(FAVICONS.png);
    const picture = sample.read(file).match(/<picture>.*?<\/picture>/s)?.[0] ?? "";
    assert.match(
      picture,
      new RegExp(
        `^<picture><source media="${escapeRegExp(REDUCED_MOTION)}" srcset="${escapeRegExp(still)}"[^>]*><img `,
      ),
    );
  });
}
