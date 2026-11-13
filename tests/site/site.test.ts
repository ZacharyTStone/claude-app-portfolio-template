/* A site's addresses (src/site/site.ts): under a path, and at the root. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeSite } from "../../src/site/site.ts";
import { sampleConfig } from "./sample.ts";

const underAPath = makeSite(sampleConfig({ url: "https://example.github.io/portfolio" }));
const atTheRoot = makeSite(sampleConfig({ url: "https://example.com" }));

test("a site under a path links to its files under it", () => {
  assert.equal(underAPath.link("/assets/og.png"), "/portfolio/assets/og.png");
});

test("a link to a thread is left as it is", () => {
  assert.equal(underAPath.link("#about"), "#about");
});

test("a link to another site is left as it is", () => {
  assert.equal(underAPath.link("https://example.com/"), "https://example.com/");
});

test("a file's full address is under the site's path", () => {
  assert.equal(underAPath.fileUrl("/assets/og.png"), "https://example.github.io/portfolio/assets/og.png");
});

test("the main language's page is at the site's path", () => {
  assert.equal(underAPath.pagePath("en"), "/portfolio/");
});

test("another language's page is in a folder named for it, under the site's path", () => {
  assert.equal(underAPath.pagePath("fr"), "/portfolio/fr/");
});

test("a page's full address is under the site's path", () => {
  assert.equal(underAPath.pageUrl("fr"), "https://example.github.io/portfolio/fr/");
});

test("a site at the root links to its files from the root", () => {
  assert.equal(atTheRoot.link("/assets/og.png"), "/assets/og.png");
});

test("a site at the root has another language's page in a folder at the root", () => {
  assert.equal(atTheRoot.pagePath("fr"), "/fr/");
});

test("a site at the root has the main language's page at its address", () => {
  assert.equal(atTheRoot.pageUrl("en"), "https://example.com/");
});
