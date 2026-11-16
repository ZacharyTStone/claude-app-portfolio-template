/* What an address names on the page (src/app/tab-addresses.ts), on a page
   in another language than the main one, on a site served under a path. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addressOfPlace,
  addressToKeep,
  openTabIn,
  ownAddress,
  placeOfLink,
  type Here,
  type IdKind,
} from "../../src/app/tab-addresses.ts";
import { ID_SELECTOR } from "../../src/contracts/page-selectors.ts";

const ORIGIN = "https://example.com";

/** What the page has: two threads and a personal answer, each with a page,
    a chat and "Something else", and the sidebar and the home screen. */
const KINDS: Record<string, IdKind> = {
  about: "tab with a page",
  work: "tab with a page",
  "personal-fun": "tab with a page",
  "chat-1": "tab",
  asked: "tab",
  tabs: "part",
  top: "part",
};

const here: Here = { origin: ORIGIN, home: "/portfolio/fr/", kindOf: (id) => KINDS[id] ?? null };

const at = (address: string): URL => new URL(address, ORIGIN);

for (const [address, tab] of [
  ["/portfolio/fr/about/", "about"],
  ["/portfolio/fr/about", "about"],
  ["/portfolio/fr/personal-fun/", "personal-fun"],
  ["/portfolio/fr/#chat-1", "chat-1"],
  ["/portfolio/fr/#about", "about"],
  ["/portfolio/fr/work/#about", "about"],
  ["/portfolio/fr/about/#tabs", "about"],
  ["/portfolio/fr/about/#nowhere", "about"],
] as const) {
  test(`${address} has the tab "${tab}" open`, () => {
    assert.equal(openTabIn(at(address), here), tab);
  });
}

for (const address of ["/portfolio/fr/", "/portfolio/fr/#top", "/portfolio/fr/about/#top", "/portfolio/fr/#tabs"]) {
  test(`${address} has the home screen open`, () => {
    assert.equal(openTabIn(at(address), here), null);
  });
}

test("a path that's a page the page has no tab for opens none", () => {
  assert.equal(openTabIn(at("/portfolio/fr/elsewhere/"), here), null);
});

test("a tab with a page has its page's path for its address, and one with none its #id on the home page", () => {
  assert.equal(ownAddress("about", here), "/portfolio/fr/about/");
  assert.equal(ownAddress("chat-1", here), "/portfolio/fr/#chat-1");
  assert.equal(addressOfPlace({ tab: null }, here), "/portfolio/fr/");
});

for (const [href, tab] of [
  ["/portfolio/fr/about/", "about"],
  ["/portfolio/fr/#chat-1", "chat-1"],
  ["/portfolio/fr/#about", "about"],
  ["/portfolio/fr/", null],
  ["/portfolio/fr/#top", null],
] as const) {
  test(`a link to ${href} goes in place, to ${tab ?? "the home screen"}`, () => {
    assert.deepEqual(placeOfLink(at(href), here), { tab });
  });
}

for (const [href, what] of [
  ["https://elsewhere.example/portfolio/fr/about/", "another site"],
  ["/portfolio/about/", "another language's page"],
  ["/portfolio/", "another language's home page"],
  ["/portfolio/fr/#about-title", "a part of the page the page has no tab for"],
  [`/portfolio/fr/about/${ID_SELECTOR.sidebar}`, "a part of the page: the drawer"],
  ["/portfolio/assets/og.png", "a file"],
] as const) {
  test(`a link to ${what} is the browser's to follow`, () => {
    assert.equal(placeOfLink(at(href), here), undefined);
  });
}

for (const [address, kept] of [
  ["/portfolio/fr/#about", "/portfolio/fr/about/"],
  ["/portfolio/fr/work/#about", "/portfolio/fr/about/"],
  ["/portfolio/fr/about", "/portfolio/fr/about/"],
  ["/portfolio/fr/#top", "/portfolio/fr/"],
  ["/portfolio/fr/about/#chat-1", "/portfolio/fr/#chat-1"],
  ["/portfolio/fr/#chat-2", "/portfolio/fr/"],
  ["/portfolio/fr/?from=mail#about", "/portfolio/fr/about/?from=mail"],
] as const) {
  test(`${address} gives way to the open tab's own address, ${kept}`, () => {
    assert.equal(addressToKeep(at(address), here), kept);
  });
}

for (const address of [
  "/portfolio/fr/",
  "/portfolio/fr/about/",
  "/portfolio/fr/#chat-1",
  "/portfolio/fr/about/#tabs",
  "/portfolio/fr/about/?from=mail",
]) {
  test(`${address} is kept as it is`, () => {
    assert.equal(addressToKeep(at(address), here), null);
  });
}
