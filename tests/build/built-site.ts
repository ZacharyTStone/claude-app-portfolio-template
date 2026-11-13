/* A built site, as files, and the tests any built site has to pass: this
   repo's own (dist/) and the sample the tests build. Every language's page
   has the main one's structure, nothing is inline, the links are safe, and
   everything on the site they point at is there, under the site's path. */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { escapeRegExp } from "es-toolkit";
import type { SiteConfig } from "../../src/config/site-config.ts";
import { isSafeHref } from "../../src/site/checks/formats.ts";
import { makeSite } from "../../src/site/site.ts";
import { basePath } from "../../src/site/url.ts";

/** A built file, and where it's served. */
type ServedFile = { file: string; url: URL };

export type BuiltSite = {
  /** What the tests call it: "this site", "the sample site". */
  name: string;
  /** Where the site is: its address, with the path it's served under ("/", "/portfolio/"). */
  url: URL;
  /** Each language's page, the main one's first. */
  languagePages: ServedFile[];
  /** Every page: each language's, and the 404 page. */
  pages: ServedFile[];
  /** Whether the build has this file, by its path in the built folder. */
  hasFile: (file: string) => boolean;
  hasFolder: (file: string) => boolean;
  read: (file: string) => string;
};

const NOT_FOUND_PAGE = "404.html";

/** The site that `config` builds into `folder`. */
export function builtSite(name: string, folder: string, config: SiteConfig): BuiltSite {
  const { codes, main } = makeSite(config);
  const url = new URL(basePath(config.url), config.url);
  const served = (file: string): ServedFile => ({ file, url: new URL(file.replace(/index\.html$/, ""), url) });
  const languagePages = codes.map((code) => served(code === main ? "index.html" : `${code}/index.html`));
  return {
    name,
    url,
    languagePages,
    pages: [...languagePages, served(NOT_FOUND_PAGE)],
    hasFile: (file) => existsSync(join(folder, file)) && statSync(join(folder, file)).isFile(),
    hasFolder: (file) => existsSync(join(folder, file)) && statSync(join(folder, file)).isDirectory(),
    read: (file) => readFileSync(join(folder, file), "utf8"),
  };
}

/** The opening tag of a section, heading, list or landmark, up to its ">":
    `<section class="tab" id="about"`. */
const STRUCTURAL_TAG = /<(section|details|h[1-4]|dl|ul|nav|header|footer|main)\b[^>]*/g;

/** An attribute a language words differently (aria-label="Tabs"), or that
    is state (open), with its value. */
const WORDING_OR_STATE_ATTRIBUTE = / (?:aria-label|aria-labelledby|open)\b(?:="[^"]*")?/g;

/** The page's outline: each structural tag, without what a language words differently. */
const outlineOf = (html: string): string[] =>
  [...html.matchAll(STRUCTURAL_TAG)].map(([tag]) => tag.replace(WORDING_OR_STATE_ATTRIBUTE, ""));

/** Something a file on the site points at. */
type Reference = {
  /** The address as the file has it: "/assets/app.css", "../", "#about". */
  ref: string;
  /** Where the file that has it is served: what a relative `ref` is relative to. */
  from: URL;
};

/** An address with a scheme: "https://example.com", "mailto:alex@example.com". */
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** A page's links and assets: every href, src and srcset that's a path, and
    the full addresses on this site that the build writes into <link>, <meta>
    and JSON-LD (canonical, hreflang, og:image…). A full address in the text
    was written by hand, and may be served by something else on the same
    host, so it's left alone. */
function pageReferences(site: BuiltSite, { file, url: from }: ServedFile): Reference[] {
  const html = site.read(file);
  const paths = [...html.matchAll(/\s(?:href|src|srcset)="([^"]*)"/g)]
    .map(([, ref = ""]) => ref)
    .filter((ref) => !HAS_SCHEME.test(ref));
  const metadataTags = html.match(/<link\b[^>]*>|<meta\b[^>]*>|<script\b[^>]*application\/ld\+json[^>]*>[^<]*/g) ?? [];
  const addressOnThisSite = new RegExp(`${escapeRegExp(site.url.origin)}[^"'\\s<>]*`, "g");
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

/** The file the host serves at a path in the site: a folder's is its index.html. */
function fileServedAt(site: BuiltSite, pathInSite: string): string {
  if (pathInSite === "" || pathInSite.endsWith("/")) return `${pathInSite}index.html`;
  return site.hasFolder(pathInSite) ? `${pathInSite}/index.html` : pathInSite;
}

const pointsNowhereOnThisSite = (ref: string): boolean => !ref || ref.startsWith("#") || ref.startsWith("data:");

/** What's wrong with a reference: nothing (null), or that it's missing or
    outside the site's path. Other sites, mailto: and #fragments are fine as
    they are. */
function problemWith(site: BuiltSite, { ref, from }: Reference): string | null {
  if (pointsNowhereOnThisSite(ref)) return null;
  const url = new URL(ref, from);
  if (url.origin !== site.url.origin) return null;
  const sitePath = site.url.pathname;
  if (!url.pathname.startsWith(sitePath)) {
    // A full address elsewhere on the same host is another site's.
    return ref.startsWith(site.url.origin) ? null : `${ref} is outside the site, which is at ${sitePath}`;
  }
  const file = fileServedAt(site, decodeURIComponent(url.pathname.slice(sitePath.length)));
  return site.hasFile(file) ? null : `${ref} isn't in the build (${file})`;
}

/** The problems with what one built file points at, each once, after the file's name. */
function problemsIn(site: BuiltSite, file: string, references: Reference[]): string[] {
  const problems = references.flatMap((reference) => problemWith(site, reference) ?? []);
  return [...new Set(problems)].map((problem) => `${file}: ${problem}`);
}

const LOADED = {
  stylesheet: { tag: /<link\b[^>]*\brel="stylesheet"[^>]*>/g, address: /\shref="([^"]*)"/ },
  script: { tag: /<script\b[^>]*\bsrc="[^"]*"[^>]*>/g, address: /\ssrc="([^"]*)"/ },
};

/** The stylesheets or the scripts the pages load, as built files (one
    that's missing is for the test of the pages' own references to report). */
function filesThePagesLoad(site: BuiltSite, kind: keyof typeof LOADED): ServedFile[] {
  const loaded = new Map<string, URL>();
  for (const page of site.pages) {
    for (const [tag] of site.read(page.file).matchAll(LOADED[kind].tag)) {
      const url = new URL(tag.match(LOADED[kind].address)?.[1] ?? "", page.url);
      const file = decodeURIComponent(url.pathname.slice(site.url.pathname.length));
      const isOnThisSite = url.origin === site.url.origin && url.pathname.startsWith(site.url.pathname);
      if (isOnThisSite && site.hasFile(file)) loaded.set(file, url);
    }
  }
  return [...loaded].map(([file, url]) => ({ file, url }));
}

/** The types of the <script> elements a page has with no src, in order. */
function inlineScriptTypes(html: string): Array<string | undefined> {
  return [...html.matchAll(/<script\b([^>]*)>/g)]
    .map(([, attributes = ""]) => attributes)
    .filter((attributes) => !/\ssrc=/.test(attributes))
    .map((attributes) => attributes.match(/\stype="([^"]*)"/)?.[1])
    .sort();
}

function testEveryLanguageHasTheSameStructure(site: BuiltSite): void {
  const [mainPage, ...otherPages] = site.languagePages;
  assert.ok(mainPage);
  if (!otherPages.length) {
    test(`${site.name}: every language's page has the same structure`, { skip: "the site is in one language" });
  }
  for (const page of otherPages) {
    test(`${site.name}: ${page.file} has the same structure as the main language's page`, () => {
      assert.deepEqual(outlineOf(site.read(page.file)), outlineOf(site.read(mainPage.file)));
    });
  }
}

function testNothingIsInline(site: BuiltSite): void {
  for (const { file } of site.pages) {
    test(`${site.name}: ${file} has no inline script but its two data blocks`, () => {
      const dataBlocks = file === NOT_FOUND_PAGE ? [] : ["application/json", "application/ld+json"];
      assert.deepEqual(inlineScriptTypes(site.read(file)), dataBlocks);
    });

    test(`${site.name}: ${file} has no inline style`, () => {
      assert.doesNotMatch(site.read(file), /<style\b|\sstyle=/i);
    });
  }
}

function testLinksAndFiles(site: BuiltSite): void {
  test(`${site.name}: every link on the pages is one the config's checks call safe`, () => {
    const hrefs = site.pages
      .flatMap(({ file }) => [...site.read(file).matchAll(/<a\b[^>]*\shref="([^"]*)"/g)])
      .map(([, href = ""]) => href);
    assert.ok(hrefs.length);
    assert.deepEqual(
      hrefs.filter((href) => !isSafeHref(href)),
      [],
    );
  });

  test(`${site.name}: everything the pages link to or load is in the build, under the site's path`, () => {
    const problems = site.pages.flatMap((page) => {
      const references = pageReferences(site, page);
      assert.ok(references.length, `${page.file} points at nothing: is it a page?`);
      return problemsIn(site, page.file, references);
    });
    assert.deepEqual(problems, []);
  });

  test(`${site.name}: every icon, font and file the stylesheets and scripts use is in the build`, () => {
    const stylesheets = filesThePagesLoad(site, "stylesheet");
    const scripts = filesThePagesLoad(site, "script");
    assert.ok(stylesheets.length, "the pages load a stylesheet");
    assert.ok(scripts.length, "the pages load a script");
    const problems = [
      ...stylesheets.flatMap(({ file, url }) => problemsIn(site, file, stylesheetReferences(site.read(file), url))),
      ...scripts.flatMap(({ file, url }) => problemsIn(site, file, scriptReferences(site.read(file), url))),
    ];
    assert.deepEqual(problems, []);
  });
}

/** The tests any built site has to pass. */
export function testBuiltSite(site: BuiltSite): void {
  testEveryLanguageHasTheSameStructure(site);
  testNothingIsInline(site);
  testLinksAndFiles(site);
}
