/* The panel's Context gathered from the answers (src/site/context-links.ts):
   which links each tab's list has, in what order, under what label and
   icon, and which it leaves out; and every link on the site, for
   llms.txt. The sample is served under a path, at
   https://example.com/portfolio/. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Block } from "../../src/config/blocks.ts";
import type { Language, PanelRow } from "../../src/config/language.ts";
import { contextLists, linksOfTheSite } from "../../src/site/context-links.ts";
import { makeSite } from "../../src/site/site.ts";
import { samplePosts } from "../sample/qiita.ts";
import { languageOf, sampleInEnglishOnly } from "./sample.ts";

/** The sample in English with one thread, "links", whose one answer is
    `answer` and whose question is `q`, and Context's own rows `ownRows`. */
function siteWith(answer: Block[], { q = "where?", ownRows = [] as PanelRow[] } = {}) {
  const config = sampleInEnglishOnly();
  const english = languageOf(config, "en");
  english.threads = [{ id: "links", title: "Links", messages: [{ q, a: answer }] }];
  english.questions.personal = [];
  english.home.intro = "Hi.";
  english.panel.context = { title: "Context", fromAnswers: true, rows: ownRows };
  return makeSite(config);
}

/** The rows of the list for `tab`: none, if it has no list. */
function rowsOf(site: ReturnType<typeof makeSite>, tab: string): PanelRow[] {
  return contextLists(site, "en").find((list) => list.of === tab)?.rows ?? [];
}

const hrefsOf = (rows: PanelRow[]) => rows.map((row) => row.href);

test("a tab lists each kind of link its answers have: a link card, a link in text and in a list, and a picture's", () => {
  const site = siteWith(
    [
      "A [post](https://blog.example.com/post) in a paragraph.",
      ["In a list: **[a talk](https://talks.example.com/)**"],
      { link: { name: "Notes", kind: "Doc", href: "https://docs.example.com/notes", icon: "file" } },
      {
        image: { src: "/a.png", alt: "A", width: 1, height: 1, caption: "The app.", href: "https://app.example.com/" },
      },
      { images: [{ src: "/b.png", alt: "B", width: 1, height: 1, href: "https://shots.example.com/b" }] },
    ],
    { q: "where's [the code](https://code.example.com/)?" },
  );
  assert.deepEqual(rowsOf(site, "links"), [
    { label: "the code", meta: "code.example.com", icon: "globe", href: "https://code.example.com/" },
    { label: "post", meta: "blog.example.com", icon: "globe", href: "https://blog.example.com/post" },
    { label: "a talk", meta: "talks.example.com", icon: "globe", href: "https://talks.example.com/" },
    { label: "Notes", meta: "docs.example.com", icon: "file", href: "https://docs.example.com/notes" },
    { label: "app.example.com", meta: "", icon: "globe", href: "https://app.example.com/" },
    { label: "shots.example.com/b", meta: "", icon: "globe", href: "https://shots.example.com/b" },
  ]);
});

test("an address is listed once, where it's first linked to, named by a link card to it wherever it is, else its first words", () => {
  const site = siteWith([
    "[One](https://one.example.com/) and [two](https://two.example.com/).",
    { link: { name: "Two again", kind: "Site", href: "https://two.example.com/", icon: "globe" } },
    "[One, written another way](https://ONE.example.com) and [three](https://three.example.com/).",
  ]);
  assert.deepEqual(
    rowsOf(site, "links").map((row) => row.label),
    ["One", "Two again", "three"],
  );
});

test("a link with no words, a picture's, is called by its address, short: no scheme, www. or last slash", () => {
  const site = siteWith([
    {
      image: {
        src: "/a.png",
        alt: "A",
        width: 1,
        height: 1,
        href: "https://www.example.org/a/",
        caption: "What it shows.",
      },
    },
  ]);
  assert.deepEqual(rowsOf(site, "links"), [
    { label: "example.org/a", meta: "", icon: "globe", href: "https://www.example.org/a/" },
  ]);
});

test("a row named by its host has no note of the host beside it", () => {
  const site = siteWith([
    { link: { name: "notes.example.com", kind: "Website", href: "https://www.notes.example.com/", icon: "globe" } },
  ]);
  assert.deepEqual(rowsOf(site, "links"), [
    { label: "notes.example.com", meta: "", icon: "globe", href: "https://www.notes.example.com/" },
  ]);
});

test("a row's icon is a link card's own, else GitHub's or LinkedIn's by the host, a file on the site, or a globe", () => {
  const site = siteWith([
    { link: { name: "Resume", kind: "PDF", href: "https://cv.example.com/cv.pdf", icon: "file" } },
    "[Code](https://github.com/someone/thing), [me](https://jp.linkedin.com/in/someone), [a PDF](/assets/cv.pdf) and [a site](https://site.example.com/).",
  ]);
  assert.deepEqual(
    rowsOf(site, "links").map((row) => [row.label, row.icon]),
    [
      ["Resume", "file"],
      ["Code", "github"],
      ["me", "linkedin"],
      ["a PDF", "file"],
      ["a site", "globe"],
    ],
  );
});

test("a file on the site is listed once, as the config first writes its address, and a page of the site isn't", () => {
  const site = siteWith([
    "[A PDF](/assets/cv.pdf), [one outside the site's path](https://example.com/assets/cv.pdf), [a picture](https://example.com/portfolio/a.png), [the PDF in full](https://example.com/portfolio/assets/cv.pdf).",
    "[About](/about/), [work](https://example.com/portfolio/work/), [home](https://example.com/portfolio) and [another site there](https://example.com/other/).",
  ]);
  assert.deepEqual(hrefsOf(rowsOf(site, "links")), [
    "/assets/cv.pdf",
    "https://example.com/assets/cv.pdf",
    "https://example.com/portfolio/a.png",
    "https://example.com/other/",
  ]);
});

test("a link to a tab, to a part of the page, by email or of another kind isn't listed", () => {
  const site = siteWith([
    "[About](#about), [the top](#top), [mail](mailto:sam@example.com), [call](tel:+100) and [ftp](ftp://example.org/f).",
  ]);
  assert.deepEqual(contextLists(site, "en"), []);
});

test("a link one of Context's own rows has stays that row, however it's written, and a row that isn't a link takes none", () => {
  const ownRows: PanelRow[] = [
    { label: "Based in", meta: "Remote", icon: "globe" },
    { label: "GitHub", meta: "Link", icon: "github", href: "https://GitHub.com/example" },
  ];
  const site = siteWith(["[My GitHub](https://github.com/example) and [my blog](https://blog.example.com/)."], {
    ownRows,
  });
  assert.deepEqual(hrefsOf(rowsOf(site, "links")), ["https://blog.example.com/"]);
});

test("each tab has a list of its own links, and none is the home screen's; every link on the site is listed once, in the page's order: its intro, each tab, then Something else", () => {
  const config = sampleInEnglishOnly();
  const english: Language = languageOf(config, "en");
  english.home.intro = "Hi, see [the blog](https://blog.example.com/).";
  english.threads = [
    {
      id: "one",
      title: "One",
      messages: [{ q: "a?", a: ["[A](https://a.example.com/), [the blog](https://blog.example.com/)"] }],
    },
    {
      id: "two",
      title: "Two",
      messages: [{ q: "b?", a: ["[B](https://b.example.com/), [A](https://a.example.com/)"] }],
    },
  ];
  english.questions.personal = [{ id: "fun", q: "fun?", a: ["[C](https://c.example.com/)"] }];
  english.asked.answer = "[D](https://d.example.com/) or [email](mailto:sam@example.com).";
  english.panel.context = { title: "Context", fromAnswers: true, rows: [] };
  const site = makeSite(config);
  assert.deepEqual(
    contextLists(site, "en").map((list) => [list.of, hrefsOf(list.rows)]),
    [
      ["one", ["https://a.example.com/", "https://blog.example.com/"]],
      ["two", ["https://b.example.com/", "https://a.example.com/"]],
      ["personal-fun", ["https://c.example.com/"]],
    ],
  );
  assert.deepEqual(hrefsOf(linksOfTheSite(site, "en")), [
    "https://blog.example.com/",
    "https://a.example.com/",
    "https://b.example.com/",
    "https://c.example.com/",
    "https://d.example.com/",
  ]);
});

test("a tab that links nowhere has no list of its own", () => {
  const site = siteWith(["Nothing to link to."]);
  assert.deepEqual(contextLists(site, "en"), []);
});

test("the Writing tab's posts aren't gathered: its answer is their list already", async () => {
  const site = makeSite(sampleInEnglishOnly(), await samplePosts());
  assert.ok(site.language("en").threads.some((thread) => thread.fetched));
  const everyHref = contextLists(site, "en").flatMap((list) => hrefsOf(list.rows));
  assert.ok(everyHref.length > 0);
  assert.ok(everyHref.every((href) => !href?.includes("qiita.com")));
});

test("a language whose Context doesn't ask for them has no lists, nor one with no Context", () => {
  const config = sampleInEnglishOnly();
  const english = languageOf(config, "en");
  const { context } = english.panel;
  assert.ok(context);
  english.panel.context = { title: context.title, rows: context.rows };
  assert.deepEqual(contextLists(makeSite(config), "en"), []);
  assert.deepEqual(linksOfTheSite(makeSite(config), "en"), []);
  english.panel = {};
  assert.deepEqual(contextLists(makeSite(config), "en"), []);
  assert.deepEqual(linksOfTheSite(makeSite(config), "en"), []);
});
