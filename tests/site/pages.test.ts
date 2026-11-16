/* The portfolio's pages (src/site/pages.ts): where each is, what its head
   says, and where a link in the config to a tab goes from it. The sample is
   in two languages, under a path. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { tabWindowTitle } from "../../src/contracts/tab-pages.ts";
import {
  alternatesOf,
  pageLink,
  portfolioPages,
  routeParameter,
  tabLinkPath,
  type PageHead,
} from "../../src/site/pages.ts";
import { makeSite } from "../../src/site/site.ts";
import { languageOf, sampleConfig } from "./sample.ts";

const config = sampleConfig();
const site = makeSite(config);
const pages = portfolioPages(site);
const english = languageOf(config, "en");

function headAt(path: string): PageHead {
  const page = pages.find(({ head }) => head.path === path);
  assert.ok(page, `the sample has a page at ${path}`);
  return page.head;
}

test("each language has its home page, then a page for each thread and each personal answer", () => {
  assert.deepEqual(
    pages.map(({ head, tab }) => [head.path, tab]),
    [
      ["/", undefined],
      ["/about/", "about"],
      ["/work/", "work"],
      ["/personal-fun/", "personal-fun"],
      ["/fr/", undefined],
      ["/fr/about/", "about"],
      ["/fr/work/", "work"],
      ["/fr/personal-fun/", "personal-fun"],
    ],
  );
});

test("the route is given each page's path without its slashes, and nothing for the site's root", () => {
  assert.deepEqual(["/", "/fr/", "/about/", "/fr/personal-fun/"].map(routeParameter), [
    undefined,
    "fr",
    "about",
    "fr/personal-fun",
  ]);
});

test("a home page's head says what the language's meta does", () => {
  assert.deepEqual(headAt("/fr/"), {
    code: "fr",
    path: "/fr/",
    title: english.meta.title,
    description: english.meta.description,
    versions: { en: "/", fr: "/fr/" },
  });
});

test("a tab's page is titled as the window is with the tab open, and described by its first answer", () => {
  assert.deepEqual(headAt("/fr/about/"), {
    code: "fr",
    path: "/fr/about/",
    title: tabWindowTitle("About", config.name),
    description: "Sam is an engineer. One Two",
    versions: { en: "/about/", fr: "/fr/about/" },
  });
});

test("a tab whose first answer has no words of its own is described as the site is", () => {
  assert.equal(headAt("/work/").description, english.meta.description);
});

test("a personal answer's page is titled by its question, and described by its answer", () => {
  const head = headAt("/personal-fun/");
  assert.deepEqual([head.title, head.description], [tabWindowTitle("for fun?", config.name), "Reading."]);
});

test("a page's alternates are each language's version, and the main one's for any other, as full addresses", () => {
  assert.deepEqual(alternatesOf(site, headAt("/fr/about/")), [
    { hreflang: "en", href: "https://example.com/portfolio/about/" },
    { hreflang: "fr", href: "https://example.com/portfolio/fr/about/" },
    { hreflang: "x-default", href: "https://example.com/portfolio/about/" },
  ]);
});

for (const [href, path] of [
  ["#about", "/fr/about/"],
  ["#personal-fun", "/fr/personal-fun/"],
  ["#top", "/fr/"],
] as const) {
  test(`a link in the config to ${href} goes to ${path} from the page in French`, () => {
    assert.equal(tabLinkPath(site, "fr", href), path);
  });
}

for (const href of ["#nowhere", "https://example.com/#about", "/assets/og.png", "mailto:sam@example.com"]) {
  test(`a link in the config to ${href} is no tab's`, () => {
    assert.equal(tabLinkPath(site, "en", href), undefined);
  });
}

test("on a site under a path, a link to a tab or a file is under it, and any other as it is", () => {
  assert.deepEqual(
    ["#about", "/assets/og.png", "#nowhere", "https://example.org/"].map((href) => pageLink(site, "fr", href)),
    ["/portfolio/fr/about/", "/portfolio/assets/og.png", "#nowhere", "https://example.org/"],
  );
});
