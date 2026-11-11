/* The built site (dist/, after `npm run build`), as files: every language's
   page has the main one's structure, its links are safe, and everything on
   the site they point at is there, under the site's path if it has one. */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import config from "../site.config.ts";
import { OUTPUT, ROOT } from "../src/site/constants.ts";
import { isSafeHref } from "../src/site/validate.ts";
import { basePath } from "../src/shared/url.ts";

const [main, ...others] = Object.keys(config.languages);
if (!main) throw new Error("site.config.ts has no languages");
/** Where the site is: its address, with the base path ("/", "/portfolio/"). */
const SITE = new URL(basePath(config.url), config.url);
const BASE = SITE.pathname;

const BUILT = join(ROOT, OUTPUT);
const read = (file: string) => readFileSync(join(BUILT, file), "utf8");
/** A language's page, as a built file: the main one's at the top. */
const pageOf = (code: string) => (code === main ? "index.html" : `${code}/index.html`);

// ---- The same structure ------------------------------------------------------------------

/** The page's outline: each opening tag of a section, heading, list or
    landmark, without the attributes a language words differently
    (aria-label…) or that are state (open), whole values included. */
function outline(html: string): string[] {
  const tags = /<(section|details|h[1-4]|dl|ul|nav|header|footer|main)\b[^>]*/g;
  const wording = / (?:aria-label|aria-labelledby|open)\b(?:="[^"]*")?/g;
  return [...html.matchAll(tags)].map(([tag]) => tag.replace(wording, ""));
}

for (const code of others) {
  test(`The ${code} page has the same structure as the main one`, () => {
    assert.deepEqual(outline(read(pageOf(code))), outline(read(pageOf(main))));
  });
}
if (!others.length) test("Every language's page has the same structure", { skip: "the site is in one language" });

// ---- Links and assets ----------------------------------------------------------------------

/** What a file on the site points at, and the address each is relative to. */
type Reference = { ref: string; from: URL };

/** A page's links and assets: every href and src that's a path, and the
    full addresses on this site that the build writes into <link>, <meta>
    and JSON-LD (canonical, hreflang, og:image…). A full address in the
    text was written by hand, and may be served by something else on the
    same host, so it's left alone. */
function pageReferences(html: string, from: URL): Reference[] {
  const isAddress = (ref: string) => /^[a-z][a-z\d+.-]*:/i.test(ref);
  const paths = [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)]
    .map(([, ref = ""]) => ref)
    .filter((ref) => !isAddress(ref));
  const metadata = html.match(/<link\b[^>]*>|<meta\b[^>]*>|<script\b[^>]*application\/ld\+json[^>]*>[^<]*/g) ?? [];
  const escaped = SITE.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const addresses = metadata.flatMap((tag) => tag.match(new RegExp(`${escaped}[^"'\\s<>]*`, "g")) ?? []);
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
  const paths = /(["'`])(\/(?!\/)[^"'`\s]*\.(?:css|js|json|svg|png|webp|ico|woff2|txt|xml|html))\1/g;
  return [...js.matchAll(paths)].map(([, , ref = ""]) => ({ ref, from }));
}

/** What's wrong with a reference: nothing (null), or that it's missing or
    outside the site's base path. Other sites, mailto: and #fragments are
    fine as they are. */
function problemWith({ ref, from }: Reference): string | null {
  if (!ref || ref.startsWith("#") || ref.startsWith("data:")) return null;
  const url = new URL(ref, from);
  if (url.origin !== SITE.origin) return null;
  if (!url.pathname.startsWith(BASE)) {
    // A full address elsewhere on the same host is another site's.
    if (ref.startsWith(SITE.origin)) return null;
    return `${ref} is outside the site, which is at ${BASE}`;
  }
  let file = decodeURIComponent(url.pathname.slice(BASE.length));
  if (file === "" || file.endsWith("/")) file += "index.html";
  else if (existsSync(join(BUILT, file)) && statSync(join(BUILT, file)).isDirectory()) file += "/index.html";
  const there = existsSync(join(BUILT, file)) && statSync(join(BUILT, file)).isFile();
  return there ? null : `${ref} isn't there (${OUTPUT}/${file})`;
}

/** Where each built page is on the site. */
const PAGES = [...[main, ...others].map(pageOf), "404.html"].map((file) => ({
  file,
  url: new URL(file.replace(/index\.html$/, ""), SITE),
}));

/** The stylesheets and scripts the pages load, as built files (one
    that's missing is the test above's to report). */
function loaded(kind: "stylesheet" | "script"): Array<{ file: string; url: URL }> {
  const found = new Map<string, URL>();
  for (const { file, url } of PAGES) {
    const html = read(file);
    const tags =
      kind === "stylesheet"
        ? html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)
        : html.matchAll(/<script\b[^>]*\bsrc="[^"]*"[^>]*>/g);
    for (const [tag] of tags) {
      const ref = tag.match(kind === "stylesheet" ? /\shref="([^"]*)"/ : /\ssrc="([^"]*)"/)?.[1] ?? "";
      const at = new URL(ref, url);
      const there = at.origin === SITE.origin && at.pathname.startsWith(BASE);
      const name = decodeURIComponent(at.pathname.slice(BASE.length));
      if (there && existsSync(join(BUILT, name))) found.set(name, at);
    }
  }
  return [...found].map(([file, url]) => ({ file, url }));
}

test("Every link on the pages is one the config's checks call safe", () => {
  const hrefs = PAGES.flatMap(({ file }) => [...read(file).matchAll(/<a\b[^>]*\shref="([^"]*)"/g)]);
  assert.ok(hrefs.length);
  assert.deepEqual(
    hrefs.map(([, href = ""]) => href).filter((href) => !isSafeHref(href)),
    [],
  );
});

test("Everything the pages link to or load is in the built site", () => {
  const problems = PAGES.flatMap(({ file, url }) => {
    const references = pageReferences(read(file), url);
    assert.ok(references.length, `${file} points at nothing: is it a page?`);
    return references.map((reference) => problemWith(reference)).flatMap((p) => (p ? [`${file}: ${p}`] : []));
  });
  assert.deepEqual([...new Set(problems)], []);
});

test("Every icon, font and file the stylesheets and scripts use is in the built site", () => {
  const stylesheets = loaded("stylesheet");
  const scripts = loaded("script");
  assert.ok(stylesheets.length, "the pages load a stylesheet");
  assert.ok(scripts.length, "the pages load a script");
  const problems = [
    ...stylesheets.flatMap(({ file, url }) => stylesheetReferences(read(file), url).map((r) => [file, r] as const)),
    ...scripts.flatMap(({ file, url }) => scriptReferences(read(file), url).map((r) => [file, r] as const)),
  ].flatMap(([file, reference]) => {
    const problem = problemWith(reference);
    return problem ? [`${file}: ${problem}`] : [];
  });
  assert.deepEqual([...new Set(problems)], []);
});
