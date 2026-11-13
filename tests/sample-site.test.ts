/* Builds a made-up site (tests/sample/site.config.ts) into a temporary
   folder, as SITE_CONFIG lets anyone do, and checks what the repo's own
   site may not show: a site under a path, on a host that reads no headers. */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { SITE_CONFIG } from "../src/integrations/site-config.ts";
import { frameOrigins } from "../src/site/security-headers.ts";
import { escapeRegExp } from "es-toolkit";
import { DATA, REDUCED_MOTION } from "../src/contracts/page-attributes.ts";
import { basePath } from "../src/site/url.ts";
import { HEADERS_FILE, ICONS, ROOT } from "../src/site/constants.ts";
import { pagePolicy } from "../src/site/hosts.ts";
import { makeSite } from "../src/site/site.ts";
import sampleConfig from "./sample/site.config.ts";

/** Where the sample site says it is: its address, with the path it's
    served under ("/portfolio/"). */
const SITE_URL = new URL(basePath(sampleConfig.url), sampleConfig.url);

/** The folder the sample is built into, removed once the tests are done. */
const BUILD_FOLDER = mkdtempSync(join(tmpdir(), "sample-site-"));
after(() => rmSync(BUILD_FOLDER, { recursive: true, force: true }));

const ASTRO = join(ROOT, "node_modules/astro/bin/astro.mjs");

/** The build itself: `astro build`, with SITE_CONFIG naming the sample. */
const astroBuild = spawnSync(process.execPath, [ASTRO, "build", "--outDir", BUILD_FOLDER], {
  cwd: ROOT,
  env: {
    ...process.env,
    [SITE_CONFIG]: fileURLToPath(new URL("sample/site.config.ts", import.meta.url)),
    ASTRO_TELEMETRY_DISABLED: "1",
  },
  encoding: "utf8",
});

/** Every file the build wrote, as a path from the build's folder. */
const builtFiles = readdirSync(BUILD_FOLDER, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(BUILD_FOLDER, join(entry.parentPath, entry.name)));
const readBuiltFile = (file: string): string => readFileSync(join(BUILD_FOLDER, file), "utf8");

const NOT_FOUND_PAGE = "404.html";
/** Every page: each language's, and the 404 page. */
const pageFiles = builtFiles.filter((file) => file.endsWith(".html"));
/** The languages' pages, which have the whole app in them. */
const languagePageFiles = pageFiles.filter((file) => file !== NOT_FOUND_PAGE);

/** Where a built file is served: a folder's index.html at the folder. */
const servedAt = (file: string): URL => new URL(file.replace(/(^|\/)index\.html$/, "$1"), SITE_URL);

/** What's wrong with a reference from a file served at `from`: nothing
    (null), or that it's outside the site's path or not in the build. */
function problemWith(ref: string, from: URL): string | null {
  const url = new URL(ref, from);
  if (url.origin !== SITE_URL.origin || /^(#|mailto:)/.test(ref)) return null;
  if (!url.pathname.startsWith(SITE_URL.pathname)) return `${ref} is outside ${SITE_URL.pathname}`;
  const pathInSite = url.pathname.slice(SITE_URL.pathname.length);
  const file = pathInSite === "" || pathInSite.endsWith("/") ? `${pathInSite}index.html` : pathInSite;
  const isBuilt = existsSync(join(BUILD_FOLDER, file)) && statSync(join(BUILD_FOLDER, file)).isFile();
  return isBuilt ? null : `${ref} isn't in the build`;
}

/** The references in a built file: a page's href, src and full addresses
    in <meta> (og:image…), a stylesheet's url()s, a script's quoted paths. */
function referencesIn(file: string): string[] {
  const text = readBuiltFile(file);
  if (file.endsWith(".html")) {
    const hrefSrcOrMetaAddress = /\s(?:href|src)="([^"]*)"|<meta [^>]*content="(https?:[^"]*)"/g;
    return [...text.matchAll(hrefSrcOrMetaAddress)].map(([, hrefOrSrc, metaAddress]) => hrefOrSrc ?? metaAddress ?? "");
  }
  if (file.endsWith(".css")) return [...text.matchAll(/url\(\s*["']?([^"')]+)/g)].map(([, ref = ""]) => ref);
  if (file.endsWith(".js")) return [...text.matchAll(/["'`](\/[^"'`\s]+\.[a-z\d]+)["'`]/g)].map(([, ref = ""]) => ref);
  return [];
}

/** The tags in a page's <head>, in order, as written. */
function headTagsOf(html: string): string[] {
  const head = html.match(/<head>(.*?)<\/head>/s)?.[1] ?? "";
  return [...head.matchAll(/<[a-z][^>]*>/g)].map(([tag]) => tag);
}

test("the sample site builds", () => {
  assert.equal(astroBuild.status, 0, astroBuild.stderr || astroBuild.stdout);
  assert.ok(pageFiles.length >= 3, `the main page, the other language's and 404.html: ${pageFiles.join(", ")}`);
});

test("every link, stylesheet, script, font and icon is under the site's path, and built", () => {
  const stylesheetsAndScripts = builtFiles.filter((file) => /\.(css|js)$/.test(file));
  assert.ok(
    stylesheetsAndScripts.some((file) => file.endsWith(".css")) &&
      stylesheetsAndScripts.some((file) => file.endsWith(".js")),
  );
  const problems = [...pageFiles, ...stylesheetsAndScripts].flatMap((file) =>
    referencesIn(file)
      .flatMap((ref) => problemWith(ref, servedAt(file)) ?? [])
      .map((problem) => `${file}: ${problem}`),
  );
  assert.deepEqual([...new Set(problems)], []);
});

test("a host that reads no _headers file gets the policy in each page, before anything it covers", () => {
  const policy = pagePolicy(makeSite(sampleConfig));
  assert.ok(policy, "the sample's host reads no _headers file");
  assert.ok(!builtFiles.includes(HEADERS_FILE));
  for (const file of pageFiles) {
    const headTags = headTagsOf(readBuiltFile(file));
    assert.match(headTags[0] ?? "", /^<meta charset=/, file);
    assert.match(headTags[1] ?? "", /^<meta name="viewport"/, file);
    assert.equal(headTags[2], `<meta http-equiv="Content-Security-Policy" content="${policy}">`, file);
    const firstLink = headTags.findIndex((tag) => tag.startsWith("<link"));
    assert.ok(firstLink > 2, `${file}: a <link> comes before the policy`);
  }
});

test("the page's policy lets frames come from the viewer's site and no other, and marks the links it opens", () => {
  const frameAddresses = Object.values(sampleConfig.viewer ?? {});
  assert.ok(frameAddresses.length, "the sample has a viewer");
  const policy = pagePolicy(makeSite(sampleConfig)) ?? "";
  assert.match(policy, new RegExp(`(^|; )frame-src ${frameOrigins(sampleConfig.viewer).join(" ")}(;|$)`));
  for (const file of languagePageFiles) {
    const html = readBuiltFile(file);
    for (const address of frameAddresses) {
      assert.ok(html.includes(`${DATA.view}="${address}"`), `${file} marks ${address}`);
    }
  }
});

test("a picture with a still offers it to a visitor who wants less motion, ahead of the moving one", () => {
  const still = makeSite(sampleConfig).link(ICONS.png);
  for (const file of languagePageFiles) {
    const html = readBuiltFile(file);
    const picture = html.match(/<picture>.*?<\/picture>/s)?.[0] ?? "";
    assert.ok(picture, `${file} has a picture with a still`);
    assert.match(
      picture,
      new RegExp(
        `^<picture><source media="${escapeRegExp(REDUCED_MOTION)}" srcset="${escapeRegExp(still)}"[^>]*><img `,
      ),
      file,
    );
  }
});

test("nothing is inline: no script but the two data blocks, no style", () => {
  for (const file of pageFiles) {
    const html = readBuiltFile(file);
    const inlineScripts = [...html.matchAll(/<script\b([^>]*)>/g)]
      .map(([, attributes = ""]) => attributes)
      .filter((attributes) => !/\ssrc=/.test(attributes));
    const types = inlineScripts.map((attributes) => attributes.match(/\stype="([^"]*)"/)?.[1]).sort();
    assert.deepEqual(types, file === NOT_FOUND_PAGE ? [] : ["application/json", "application/ld+json"], file);
    assert.doesNotMatch(html, /<style\b|\sstyle=/i, file);
  }
});
