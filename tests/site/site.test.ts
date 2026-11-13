/* A site (src/site/site.ts): its addresses, under a path and at the root,
   and every string its pages say. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ENGLISH_STRINGS } from "../../src/config/english-strings.ts";
import { makeSite } from "../../src/site/site.ts";
import { languageOf, sampleConfig } from "./sample.ts";

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

const inEnglishWithNoStrings = sampleConfig();
delete languageOf(inEnglishWithNoStrings, "en").strings;

test("a page in English says English's own words where its config states none", () => {
  assert.deepEqual(makeSite(inEnglishWithNoStrings).language("en").strings, ENGLISH_STRINGS);
});

test("a page in English says its own words for the strings its config states", () => {
  const withACreditOfItsOwn = sampleConfig();
  languageOf(withACreditOfItsOwn, "en").strings = { credit: "Made by Sam." };
  assert.deepEqual(makeSite(withACreditOfItsOwn).language("en").strings, {
    ...ENGLISH_STRINGS,
    credit: "Made by Sam.",
  });
});

test("a string stated as undefined is a string left out", () => {
  const withNoCredit = sampleConfig();
  languageOf(withNoCredit, "en").strings = { credit: undefined };
  assert.equal(makeSite(withNoCredit).language("en").strings.credit, ENGLISH_STRINGS.credit);
});

test("a page in another language says the words its config states", () => {
  const sample = sampleConfig();
  assert.deepEqual(makeSite(sample).language("fr").strings, languageOf(sample, "fr").strings);
});

const inFrenchWithNoStrings = sampleConfig();
delete languageOf(inFrenchWithNoStrings, "fr").strings;
const frenchStrings = makeSite(inFrenchWithNoStrings).language("fr").strings;

test("a string another language leaves out is said in English, which the checks call a problem", () => {
  assert.equal(frenchStrings.skip, ENGLISH_STRINGS.skip);
});

test("another language isn't lent English's words for a part its site may not have", () => {
  assert.deepEqual([frenchStrings.viewerOpen, frenchStrings.play], [undefined, undefined]);
});
