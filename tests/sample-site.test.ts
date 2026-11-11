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
import { basePath } from "../src/shared/url.ts";
import { ROOT } from "../src/site/constants.ts";
import { pagePolicy } from "../src/site/hosts.ts";
import { makeSite } from "../src/site/site.ts";
import sample from "./sample/site.config.ts";

const SITE = new URL(basePath(sample.url), sample.url);
const OUT = mkdtempSync(join(tmpdir(), "sample-site-"));
after(() => rmSync(OUT, { recursive: true, force: true }));

const build = spawnSync(process.execPath, [join(ROOT, "node_modules/astro/bin/astro.mjs"), "build", "--outDir", OUT], {
  cwd: ROOT,
  env: {
    ...process.env,
    [SITE_CONFIG]: fileURLToPath(new URL("sample/site.config.ts", import.meta.url)),
    ASTRO_TELEMETRY_DISABLED: "1",
  },
  encoding: "utf8",
});

const files = readdirSync(OUT, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(OUT, join(entry.parentPath, entry.name)));
const read = (file: string) => readFileSync(join(OUT, file), "utf8");
const pages = files.filter((file) => file.endsWith(".html"));
/** Where a built file is served. */
const urlOf = (file: string) => new URL(file.replace(/(^|\/)index\.html$/, "$1"), SITE);

/** What's wrong with a reference from a file served at `from`: nothing
    (null), or that it's outside the site's path or not in the build. */
function problemWith(ref: string, from: URL): string | null {
  const url = new URL(ref, from);
  if (url.origin !== SITE.origin || /^(#|mailto:)/.test(ref)) return null;
  if (!url.pathname.startsWith(SITE.pathname)) return `${ref} is outside ${SITE.pathname}`;
  const path = url.pathname.slice(SITE.pathname.length);
  const file = path === "" || path.endsWith("/") ? `${path}index.html` : path;
  return existsSync(join(OUT, file)) && statSync(join(OUT, file)).isFile() ? null : `${ref} isn't in the build`;
}

/** The references in a built file: a page's href, src and full addresses
    in <meta> (og:image…), a stylesheet's url()s, a script's quoted paths. */
function referencesIn(file: string): string[] {
  const text = read(file);
  if (file.endsWith(".html"))
    return [...text.matchAll(/\s(?:href|src)="([^"]*)"|<meta [^>]*content="(https?:[^"]*)"/g)].map(
      ([, a, b]) => a ?? b ?? "",
    );
  if (file.endsWith(".css")) return [...text.matchAll(/url\(\s*["']?([^"')]+)/g)].map(([, ref = ""]) => ref);
  if (file.endsWith(".js")) return [...text.matchAll(/["'`](\/[^"'`\s]+\.[a-z\d]+)["'`]/g)].map(([, ref = ""]) => ref);
  return [];
}

/** The tags in a page's <head>, in order, as written. */
const headOf = (html: string) =>
  [...(html.match(/<head>(.*?)<\/head>/s)?.[1] ?? "").matchAll(/<[a-z][^>]*>/g)].map(([tag]) => tag);

test("the sample site builds", () => {
  assert.equal(build.status, 0, build.stderr || build.stdout);
  assert.ok(pages.length >= 3, `the main page, the other language's and 404.html: ${pages.join(", ")}`);
});

test("every link, stylesheet, script, font and icon is under the site's path, and built", () => {
  const loaded = files.filter((file) => /\.(css|js)$/.test(file));
  assert.ok(loaded.some((file) => file.endsWith(".css")) && loaded.some((file) => file.endsWith(".js")));
  const problems = [...pages, ...loaded].flatMap((file) =>
    referencesIn(file)
      .flatMap((ref) => problemWith(ref, urlOf(file)) ?? [])
      .map((problem) => `${file}: ${problem}`),
  );
  assert.deepEqual([...new Set(problems)], []);
});

test("a host that reads no _headers file gets the policy in each page, before anything it covers", () => {
  const policy = pagePolicy(makeSite(sample));
  assert.ok(policy, "the sample's host reads no _headers file");
  assert.ok(!files.includes("_headers"));
  for (const file of pages) {
    const head = headOf(read(file));
    assert.match(head[0] ?? "", /^<meta charset=/, file);
    assert.match(head[1] ?? "", /^<meta name="viewport"/, file);
    assert.equal(head[2], `<meta http-equiv="Content-Security-Policy" content="${policy}">`, file);
    assert.ok(head.findIndex((tag) => tag.startsWith("<link")) > 2, `${file}: a <link> comes before the policy`);
  }
});

test("nothing is inline: no script but the two data blocks, no style", () => {
  for (const file of pages) {
    const html = read(file);
    const inline = [...html.matchAll(/<script\b([^>]*)>/g)]
      .map(([, attrs = ""]) => attrs)
      .filter((a) => !/\ssrc=/.test(a));
    const types = inline.map((attrs) => attrs.match(/\stype="([^"]*)"/)?.[1]).sort();
    assert.deepEqual(types, file === "404.html" ? [] : ["application/json", "application/ld+json"], file);
    assert.doesNotMatch(html, /<style\b|\sstyle=/i, file);
  }
});
