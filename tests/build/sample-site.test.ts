/* Builds the sample site (tests/sample) and checks what the repo's own
   site may not show: a site under a path, in two languages, with Ask on, a
   viewer and a picture that has a still; and the same site on a host that
   reads no headers. */
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { escapeRegExp } from "es-toolkit";
import { ASK_INDEX_FILE, ASK_PATH } from "../../src/contracts/ask.ts";
import { DATA, REDUCED_MOTION } from "../../src/contracts/page-attributes.ts";
import type { SiteConfig } from "../../src/config/site-config.ts";
import { HEADERS_FILE, headersFile, pagePolicy } from "../../src/site/files/headers-file.ts";
import { frameOrigins } from "../../src/site/security-headers.ts";
import { makeSite } from "../../src/site/site.ts";
import { folderForConfigs, writeSampleConfig } from "../sample/as-a-file.ts";
import { buildSample } from "../sample/build.ts";
import sampleConfig from "../sample/site.config.ts";
import { builtSite, testBuiltSite } from "./built-site.ts";

const folder = folderForConfigs();

const BUILD_FOLDER = join(folder, "dist");
const built = buildSample(BUILD_FOLDER);
const sample = builtSite("the sample site", BUILD_FOLDER, sampleConfig);
const sampleSite = makeSite(sampleConfig);

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

test("the sample's host reads a _headers file, so the build writes the site's headers there", () => {
  assert.equal(sample.read(HEADERS_FILE), headersFile(sampleSite));
});

test("the sample has Ask on, so the build writes what /ask picks from", () => {
  assert.equal(JSON.parse(sample.read(ASK_INDEX_FILE)).name, sampleConfig.name);
});

const frameAddresses = Object.values(sampleConfig.viewer ?? {});

for (const { file } of sample.languagePages) {
  test(`${file} says where /ask is, under the site's path`, () => {
    assert.ok(sample.read(file).includes(` ${DATA.ask}="${sampleSite.link(ASK_PATH)}"`));
  });

  test(`${file} marks the link the viewer opens with the address it shows`, () => {
    const html = sample.read(file);
    assert.ok(frameAddresses.length, "the sample has a viewer");
    const unmarked = frameAddresses.filter((address) => !html.includes(`${DATA.viewerAddress}="${address}"`));
    assert.deepEqual(unmarked, []);
  });

  test(`${file} offers a moving picture's still to a visitor who wants less motion, ahead of the moving one`, () => {
    const still = sampleSite.link("/assets/sample-icon-still.svg");
    const picture = sample.read(file).match(/<picture>.*?<\/picture>/s)?.[0] ?? "";
    assert.match(
      picture,
      new RegExp(
        `^<picture><source media="${escapeRegExp(REDUCED_MOTION)}" srcset="${escapeRegExp(still)}"[^>]*><img `,
      ),
    );
  });
}

/** The sample on a host that reads no _headers file, where Ask can't run. */
const ON_A_STATIC_HOST = 'config.host = "github-pages"; delete config.ask;';
const onAStaticHost: SiteConfig = { ...sampleConfig, host: "github-pages", ask: undefined };

const staticConfigPath = join(folder, "static-host.config.ts");
writeSampleConfig(staticConfigPath, ON_A_STATIC_HOST);
const STATIC_BUILD_FOLDER = join(folder, "static-host-dist");
const builtForAStaticHost = buildSample(STATIC_BUILD_FOLDER, staticConfigPath);
const staticSample = builtSite("the sample on a host that reads no headers", STATIC_BUILD_FOLDER, onAStaticHost);
const policy = pagePolicy(makeSite(onAStaticHost));

/** The tags in a page's <head>, in order, as written. */
function headTagsOf(html: string): string[] {
  const head = html.match(/<head>(.*?)<\/head>/s)?.[1] ?? "";
  return [...head.matchAll(/<[a-z][^>]*>/g)].map(([tag]) => tag);
}

test("the sample builds for a host that reads no _headers file, and the build writes none", () => {
  assert.equal(builtForAStaticHost.status, 0, builtForAStaticHost.stderr || builtForAStaticHost.stdout);
  assert.ok(policy);
  assert.ok(!staticSample.hasFile(HEADERS_FILE));
});

for (const { file } of staticSample.pages) {
  test(`on such a host ${file} carries the policy right after its charset and viewport, before anything the policy covers`, () => {
    const headTags = headTagsOf(staticSample.read(file));
    assert.match(headTags[0] ?? "", /^<meta charset=/);
    assert.match(headTags[1] ?? "", /^<meta name="viewport"/);
    assert.equal(headTags[2], `<meta http-equiv="Content-Security-Policy" content="${policy}">`);
    assert.ok(headTags.findIndex((tag) => tag.startsWith("<link")) > 2, "a <link> comes before the policy");
  });
}

test("the policy a page carries lets frames come from the viewer's site and no other", () => {
  assert.match(policy ?? "", new RegExp(`(^|; )frame-src ${frameOrigins(sampleConfig.viewer).join(" ")}(;|$)`));
});
