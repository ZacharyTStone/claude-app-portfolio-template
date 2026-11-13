/* The built site (dist/, after `npm run build`), as files: every language's
   page has the main one's structure, its links are safe, and everything on
   the site they point at is there, under the site's path if it has one. */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { escapeRegExp } from "es-toolkit";
import config from "../site.config.ts";
import { OUTPUT, ROOT } from "../src/site/constants.ts";
import { isSafeHref } from "../src/site/checks/formats.ts";
import { basePath } from "../src/site/url.ts";

const [mainCode, ...otherCodes] = Object.keys(config.languages);
if (!mainCode) throw new Error("site.config.ts has no languages");

/** Where the site is: its address, with the path it's served under ("/",
    "/portfolio/"). */
const SITE_URL = new URL(basePath(config.url), config.url);
const SITE_PATH = SITE_URL.pathname;

const BUILT_FOLDER = join(ROOT, OUTPUT);
const isBuiltFile = (file: string): boolean =>
  existsSync(join(BUILT_FOLDER, file)) && statSync(join(BUILT_FOLDER, file)).isFile();
const isBuiltFolder = (file: string): boolean =>
  existsSync(join(BUILT_FOLDER, file)) && statSync(join(BUILT_FOLDER, file)).isDirectory();
const readBuiltFile = (file: string): string => readFileSync(join(BUILT_FOLDER, file), "utf8");

/** A language's page, as a built file: the main one's at the top. */
const pageFileOf = (code: string): string => (code === mainCode ? "index.html" : `${code}/index.html`);

// ---- The same structure ------------------------------------------------------------------

/** The opening tag of a section, heading, list or landmark, up to its ">":
    `<section class="tab" id="about"`. */
const STRUCTURAL_TAG = /<(section|details|h[1-4]|dl|ul|nav|header|footer|main)\b[^>]*/g;

/** An attribute a language words differently (aria-label="Tabs"), or that
    is state (open), with its value. */
const WORDING_OR_STATE_ATTRIBUTE = / (?:aria-label|aria-labelledby|open)\b(?:="[^"]*")?/g;

/** The page's outline: each opening tag of a section, heading, list or
    landmark, without the attributes a language words differently
    (aria-label…) or that are state (open), whole values included. */
function outlineOf(html: string): string[] {
  return [...html.matchAll(STRUCTURAL_TAG)].map(([tag]) => tag.replace(WORDING_OR_STATE_ATTRIBUTE, ""));
}

for (const code of otherCodes) {
  test(`The ${code} page has the same structure as the main one`, () => {
    assert.deepEqual(outlineOf(readBuiltFile(pageFileOf(code))), outlineOf(readBuiltFile(pageFileOf(mainCode))));
  });
}
if (!otherCodes.length) test("Every language's page has the same structure", { skip: "the site is in one language" });

// ---- Links and assets ----------------------------------------------------------------------

/** Something a file on the site points at. */
type Reference = {
  /** The address as the file has it: "/assets/app.css", "../", "#about". */
  ref: string;
  /** Where the file that has it is served: what a relative `ref` is relative to. */
  from: URL;
};

/** An address with a scheme: "https://example.com", "mailto:alex@example.com". */
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** A page's links and assets: every href, src and srcset that's a path, and the
    full addresses on this site that the build writes into <link>, <meta>
    and JSON-LD (canonical, hreflang, og:image…). A full address in the
    text was written by hand, and may be served by something else on the
    same host, so it's left alone. */
function pageReferences(html: string, from: URL): Reference[] {
  const paths = [...html.matchAll(/\s(?:href|src|srcset)="([^"]*)"/g)]
    .map(([, ref = ""]) => ref)
    .filter((ref) => !HAS_SCHEME.test(ref));
  const metadataTags = html.match(/<link\b[^>]*>|<meta\b[^>]*>|<script\b[^>]*application\/ld\+json[^>]*>[^<]*/g) ?? [];
  const addressOnThisSite = new RegExp(`${escapeRegExp(SITE_URL.origin)}[^"'\\s<>]*`, "g");
  const addresses = metadataTags.flatMap((tag) => tag.match(addressOnThisSite) ?? []);
  return [...paths, ...addresses].map((ref) => ({ ref, from }));
}

/** A stylesheet's url()s and @imports. */
function stylesheetReferences(css: string, from: URL): Reference[] {
  const urls = [...css.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/g)].map(([, , ref = ""]) => ref);
  const imports = [...css.matchAll(/@import\s+(["'])([^"']+)\1/g)].map(([, , ref = ""]) => ref);
  return [...urls, ...imports].map((ref) => ({ ref, from }));
}

/** A script's paths on the site: any quoted "/…" ending in a file type. */
function scriptReferences(js: string, from: URL): Reference[] {
  const quotedPathToFile = /(["'`])(\/(?!\/)[^"'`\s]*\.(?:css|js|json|svg|png|webp|ico|woff2|txt|xml|html))\1/g;
  return [...js.matchAll(quotedPathToFile)].map(([, , ref = ""]) => ({ ref, from }));
}

/** What's wrong with a reference: nothing (null), or that it's missing or
    outside the site's base path. Other sites, mailto: and #fragments are
    fine as they are. */
function problemWith({ ref, from }: Reference): string | null {
  if (!ref || ref.startsWith("#") || ref.startsWith("data:")) return null;
  const url = new URL(ref, from);
  if (url.origin !== SITE_URL.origin) return null;
  if (!url.pathname.startsWith(SITE_PATH)) {
    // A full address elsewhere on the same host is another site's.
    if (ref.startsWith(SITE_URL.origin)) return null;
    return `${ref} is outside the site, which is at ${SITE_PATH}`;
  }
  // The file the host serves there: a folder's is its index.html.
  let file = decodeURIComponent(url.pathname.slice(SITE_PATH.length));
  if (file === "" || file.endsWith("/")) file += "index.html";
  else if (isBuiltFolder(file)) file += "/index.html";
  return isBuiltFile(file) ? null : `${ref} isn't there (${OUTPUT}/${file})`;
}

/** A built file, and where it's served. */
type ServedFile = { file: string; url: URL };

/** Each built page: every language's, and the 404 page. */
const PAGES: ServedFile[] = [...[mainCode, ...otherCodes].map(pageFileOf), "404.html"].map((file) => ({
  file,
  url: new URL(file.replace(/index\.html$/, ""), SITE_URL),
}));

/** The stylesheets or the scripts the pages load, as built files (one
    that's missing is the test above's to report). */
function filesThePagesLoad(kind: "stylesheet" | "script"): ServedFile[] {
  const tagOfKind =
    kind === "stylesheet" ? /<link\b[^>]*\brel="stylesheet"[^>]*>/g : /<script\b[^>]*\bsrc="[^"]*"[^>]*>/g;
  const addressInTag = kind === "stylesheet" ? /\shref="([^"]*)"/ : /\ssrc="([^"]*)"/;
  const loaded = new Map<string, URL>();
  for (const page of PAGES) {
    for (const [tag] of readBuiltFile(page.file).matchAll(tagOfKind)) {
      const ref = tag.match(addressInTag)?.[1] ?? "";
      const url = new URL(ref, page.url);
      const isOnThisSite = url.origin === SITE_URL.origin && url.pathname.startsWith(SITE_PATH);
      const file = decodeURIComponent(url.pathname.slice(SITE_PATH.length));
      if (isOnThisSite && existsSync(join(BUILT_FOLDER, file))) loaded.set(file, url);
    }
  }
  return [...loaded].map(([file, url]) => ({ file, url }));
}

test("Every link on the pages is one the config's checks call safe", () => {
  const hrefs = PAGES.flatMap(({ file }) => [...readBuiltFile(file).matchAll(/<a\b[^>]*\shref="([^"]*)"/g)]).map(
    ([, href = ""]) => href,
  );
  assert.ok(hrefs.length);
  assert.deepEqual(
    hrefs.filter((href) => !isSafeHref(href)),
    [],
  );
});

test("Everything the pages link to or load is in the built site", () => {
  const problems = PAGES.flatMap(({ file, url }) => {
    const references = pageReferences(readBuiltFile(file), url);
    assert.ok(references.length, `${file} points at nothing: is it a page?`);
    return references.flatMap((reference) => {
      const problem = problemWith(reference);
      return problem ? [`${file}: ${problem}`] : [];
    });
  });
  assert.deepEqual([...new Set(problems)], []);
});

test("Every icon, font and file the stylesheets and scripts use is in the built site", () => {
  const stylesheets = filesThePagesLoad("stylesheet");
  const scripts = filesThePagesLoad("script");
  assert.ok(stylesheets.length, "the pages load a stylesheet");
  assert.ok(scripts.length, "the pages load a script");
  const references = [
    ...stylesheets.flatMap(({ file, url }) =>
      stylesheetReferences(readBuiltFile(file), url).map((r) => [file, r] as const),
    ),
    ...scripts.flatMap(({ file, url }) => scriptReferences(readBuiltFile(file), url).map((r) => [file, r] as const)),
  ];
  const problems = references.flatMap(([file, reference]) => {
    const problem = problemWith(reference);
    return problem ? [`${file}: ${problem}`] : [];
  });
  assert.deepEqual([...new Set(problems)], []);
});
