/* src/contracts/tab-pages.ts: where a tab's page is, which the build writes
   it at and the script reads an address back from, and its window title. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SEPARATOR, tabIdInPath, tabPagePath, tabWindowTitle } from "../../src/contracts/tab-pages.ts";

test("a tab's page is its id under its language's home page, ending in a slash", () => {
  assert.equal(tabPagePath("/", "about"), "/about/");
  assert.equal(tabPagePath("/ja/", "about"), "/ja/about/");
  assert.equal(tabPagePath("/portfolio/ja/", "personal-food"), "/portfolio/ja/personal-food/");
});

for (const [home, path] of [
  ["/", "/about/"],
  ["/ja/", "/ja/about/"],
  ["/portfolio/", "/portfolio/about/"],
  ["/", "/about"],
] as const) {
  test(`${path} is the page of the tab "about" under ${home}`, () => {
    assert.equal(tabIdInPath(home, path), "about");
  });
}

for (const [home, path, what] of [
  ["/", "/", "the home page itself"],
  ["/", "/ja/about/", "another language's tab's page"],
  ["/ja/", "/about/", "the main language's page, from another's"],
  ["/", "/assets/og.png", "a file"],
  ["/", "/About/", "a path no id has"],
  ["/portfolio/", "/about/", "a page outside the site's path"],
] as const) {
  test(`${path} under ${home} is no tab's page: ${what}`, () => {
    assert.equal(tabIdInPath(home, path), null);
  });
}

test("a tab's window title is its name, then the site's", () => {
  assert.equal(tabWindowTitle("About", "Sam Sample"), `About${SEPARATOR}Sam Sample`);
});
