/* The Writing tab, as the build makes it of the posts it fetched
   (src/site/writing/tab.ts, and src/site/site.ts, which adds it to every
   language's page). */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { LinkCard } from "../../../src/config/blocks.ts";
import { ENGLISH_STRINGS } from "../../../src/config/english-strings.ts";
import { WRITING_ICON, WRITING_TAB } from "../../../src/config/writing.ts";
import { makeSite, type SiteLanguage } from "../../../src/site/site.ts";
import type { Post } from "../../../src/site/writing/post.ts";
import { postCard, type CardWording } from "../../../src/site/writing/tab.ts";
import { samplePosts } from "../../sample/writing.ts";
import { languageOf, sampleConfig } from "../sample.ts";

const posts = await samplePosts();
const site = makeSite(sampleConfig(), posts);

const writingTabOf = (language: SiteLanguage) => {
  const tab = language.threads.find((thread) => thread.id === WRITING_TAB);
  assert.ok(tab, "the page has the Writing tab");
  return tab;
};

const cardsIn = (language: SiteLanguage): LinkCard[] =>
  (writingTabOf(language).messages[0]?.a ?? []).flatMap((block) =>
    typeof block === "object" && "link" in block ? [block.link] : [],
  );

const post: Post = {
  id: "c0ffee0000000000c0f1",
  title: "Astroで静的サイトを組み立てる",
  url: "https://qiita.com/sam-sample/items/c0ffee0000000000c0f1",
  posted: "2026-10-01T09:30:00+09:00",
  place: "Qiita",
  likes: { count: 12, word: "LGTM" },
  tags: ["Astro", "TypeScript"],
};

/** A card on a page in `pageLanguage`, in English's words, in a tab of one
    place's posts, unless a test says otherwise. */
const cardOf = (one: Post, pageLanguage: string, wording: Partial<CardWording> = {}) =>
  postCard(one, { pageLanguage, strings: ENGLISH_STRINGS, namesPlace: false, ...wording });

for (const code of site.codes) {
  test(`${code}: the Writing tab comes after the page's own threads, marked as made from what was fetched`, () => {
    const { threads } = site.language(code);
    assert.equal(threads.at(-1)?.id, WRITING_TAB);
    assert.equal(threads.at(-1)?.fetched, true);
    assert.equal(threads.filter((thread) => thread.fetched).length, 1);
  });

  test(`${code}: the Writing tab is the page's own wording, around the posts, newest first`, () => {
    const language = site.language(code);
    const { strings } = language;
    const tab = writingTabOf(language);
    assert.deepEqual(
      { title: tab.title, q: tab.messages[0]?.q, before: tab.messages[0]?.a[0] },
      { title: strings.writingTitle, q: strings.writingQuestion, before: strings.writingIntro },
    );
    assert.deepEqual(
      cardsIn(language).map((card) => card.href),
      posts.map((each) => each.url),
    );
  });
}

test("every language lists the same posts, each with its title as its author wrote it", () => {
  const titles = site.codes.map((code) => cardsIn(site.language(code)).map((card) => card.name));
  for (const each of titles)
    assert.deepEqual(
      each,
      posts.map((one) => one.title),
    );
});

test("a post's card has its title over the day, in the page's language, its LGTMs and its tags", () => {
  assert.deepEqual(
    ["en", "fr", "ja"].map((code) => cardOf(post, code).kind),
    [
      "Oct 1, 2026 · 12 LGTM · Astro, TypeScript",
      "1 oct. 2026 · 12 LGTM · Astro, TypeScript",
      "2026/10/01 · 12 LGTM · Astro, TypeScript",
    ],
  );
  assert.deepEqual(
    { name: cardOf(post, "en").name, href: cardOf(post, "en").href, icon: cardOf(post, "en").icon },
    { name: post.title, href: post.url, icon: WRITING_ICON },
  );
});

test("the day is the author's, not the build's: a post from just after midnight in Tokyo is that day's", () => {
  const justAfterMidnight = { ...post, posted: "2026-10-01T00:10:00+09:00" };
  assert.match(cardOf(justAfterMidnight, "en").kind, /^Oct 1, 2026 · /);
});

test("in a language the platform can't write a date in, the day is written as the post has it", () => {
  assert.match(cardOf(post, "en-x1").kind, /^2026-10-01 · /);
});

test("a post from a place with no word of its own for likes counts them in the page's, and one that doesn't count them shows none", () => {
  const onZenn = { ...post, place: "Zenn", likes: { count: 1527 } };
  assert.equal(cardOf(onZenn, "en").kind, "Oct 1, 2026 · 1,527 likes · Astro, TypeScript");
  const japanese = { ...ENGLISH_STRINGS, writingLikes: "いいね" };
  assert.equal(cardOf(onZenn, "ja", { strings: japanese }).kind, "2026/10/01 · 1,527 いいね · Astro, TypeScript");
  const fromAFeed = { ...post, place: "note", likes: undefined, tags: [] };
  assert.equal(cardOf(fromAFeed, "en").kind, "Oct 1, 2026");
});

test("in a tab of posts from more than one place, each card names its own", () => {
  assert.equal(cardOf(post, "en", { namesPlace: true }).kind, "Oct 1, 2026 · Qiita · 12 LGTM · Astro, TypeScript");
});

test("the sample's tab has posts from three places, so each of its cards names its own", () => {
  const places = new Set(posts.map((one) => one.place));
  assert.deepEqual([...places].toSorted(), ["Qiita", "Zenn", "note"]);
  for (const [at, card] of cardsIn(site.language(site.main)).entries()) {
    assert.ok(card.kind?.includes(` · ${posts[at]?.place}`), `${card.name}'s card names ${posts[at]?.place}`);
  }
});

test("a post without tags has none in its card", () => {
  assert.equal(cardOf({ ...post, tags: [] }, "en").kind, "Oct 1, 2026 · 12 LGTM");
});

test("a title in Japanese is marked as Japanese on a page in another language, and not on a Japanese page", () => {
  assert.deepEqual(
    ["en", "fr", "ja", "ja-JP"].map((code) => cardOf(post, code).lang),
    ["ja", "ja", undefined, undefined],
  );
});

test("a title with no kana isn't marked: it could be in English, or in Chinese", () => {
  for (const title of ["Testing a static site in Playwright", "静的網站"]) {
    assert.equal(cardOf({ ...post, title }, "en").lang, undefined);
  }
});

test("with no posts, there's no Writing tab, no row for it and no posts", () => {
  const withNone = makeSite(sampleConfig(), []);
  assert.deepEqual(withNone.posts, []);
  for (const code of withNone.codes) {
    const { threads, sidebar } = withNone.language(code);
    assert.ok(!threads.some((thread) => thread.id === WRITING_TAB));
    assert.ok(!sidebar.nav.some((row) => row.tab === WRITING_TAB));
  }
});

test("with no posts, on a site whose tab is there before the first, the tab says there are none", () => {
  const config = sampleConfig({ writing: { qiita: "sam-sample", showWhenEmpty: true } });
  const withNone = makeSite(config, []).language("en");
  assert.deepEqual(writingTabOf(withNone).messages[0]?.a, [ENGLISH_STRINGS.writingEmpty]);
  assert.equal(withNone.sidebar.nav.at(-1)?.tab, WRITING_TAB);
});

test("the sidebar's top rows end with the Writing tab's, by its title and icon", () => {
  for (const code of site.codes) {
    const { sidebar, strings } = site.language(code);
    assert.deepEqual(sidebar.nav.at(-1), { tab: WRITING_TAB, icon: WRITING_ICON, label: strings.writingTitle });
  }
});

test("a sidebar that already has a row for the Writing tab keeps it where it is, and gets no other", () => {
  const config = sampleConfig();
  for (const language of Object.values(config.languages)) {
    language.sidebar.groups[0]?.tabs.push({ tab: WRITING_TAB, title: "Posts", subtitle: "On Qiita" });
  }
  const { sidebar } = makeSite(config, posts).language("en");
  assert.equal(sidebar.nav.filter((row) => row.tab === WRITING_TAB).length, 0);
  assert.deepEqual(sidebar.nav, languageOf(config, "en").sidebar.nav);
});

test("a site without writing has no Writing tab and no posts, whatever it's given", () => {
  const without = makeSite(sampleConfig({ writing: undefined }), posts);
  assert.deepEqual(without.posts, []);
  for (const code of without.codes) {
    const { threads, sidebar } = without.language(code);
    assert.ok(!threads.some((thread) => thread.id === WRITING_TAB));
    assert.ok(!sidebar.nav.some((row) => row.tab === WRITING_TAB));
  }
});
