/* A post read in the page's language: the link to Google Translate's
   machine translation of it, on a site with writing.translate
   (src/site/writing/translation.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { LANGUAGE_PLACEHOLDER } from "../../../src/config/writing.ts";
import type { Post } from "../../../src/site/writing/post.ts";
import {
  GOOGLE_TRANSLATE,
  postLanguage,
  postTranslation,
  translationAddress,
} from "../../../src/site/writing/translation.ts";

const japanese: Post = {
  id: "c0ffee0000000000c0f1",
  title: "Astroで静的サイトを組み立てる",
  url: "https://qiita.com/sam-sample/items/c0ffee0000000000c0f1",
  posted: "2026-10-01T09:30:00+09:00",
  place: "Qiita",
  tags: [],
};
const english: Post = { ...japanese, title: "Testing a static site in Playwright" };

const WORDING = `Read it, from ${LANGUAGE_PLACEHOLDER}`;

test("a post with kana in its title or its text is in Japanese, and any other in the site's main language", () => {
  assert.equal(postLanguage(japanese, "en"), "ja");
  assert.equal(postLanguage({ ...english, body: "本文はひらがなで書いた。" }, "en"), "ja");
  assert.equal(postLanguage(english, "en"), "en");
  assert.equal(postLanguage(english, "en-US"), "en", "without its region");
});

test("on a site whose main language is Japanese, a post with no kana is in a language that can't be told", () => {
  assert.equal(postLanguage(english, "ja"), undefined);
  assert.equal(postLanguage(japanese, "ja"), "ja");
});

test("the translation is Google Translate's, from the post's language into the page's, with the post's address in full", () => {
  const address = new URL(translationAddress("https://qiita.com/a/items/1?x=1&y=2#top", "ja", "en"));
  assert.equal(`${address.origin}${address.pathname}`, GOOGLE_TRANSLATE);
  assert.deepEqual(Object.fromEntries(address.searchParams), {
    sl: "ja",
    tl: "en",
    hl: "en",
    u: "https://qiita.com/a/items/1?x=1&y=2#top",
  });
});

test("the link names the post's language in the page's words", () => {
  const onEnglish = postTranslation(japanese, { pageLanguage: "en", mainLanguage: "en", wording: WORDING });
  assert.equal(onEnglish?.label, "Read it, from Japanese");
  const onJapanese = postTranslation(english, { pageLanguage: "ja", mainLanguage: "en", wording: WORDING });
  assert.equal(onJapanese?.label, "Read it, from 英語");
  assert.equal(onJapanese?.href, translationAddress(english.url, "en", "ja"));
});

test("a page with a region in its language is translated into the language alone", () => {
  const translated = postTranslation(japanese, { pageLanguage: "en-US", mainLanguage: "en-US", wording: WORDING });
  assert.equal(translated?.href, translationAddress(japanese.url, "ja", "en"));
});

test("no link for a post in the page's language, or in one that can't be told", () => {
  assert.equal(postTranslation(japanese, { pageLanguage: "ja-JP", mainLanguage: "en", wording: WORDING }), undefined);
  assert.equal(postTranslation(english, { pageLanguage: "en", mainLanguage: "en", wording: WORDING }), undefined);
  assert.equal(postTranslation(english, { pageLanguage: "en", mainLanguage: "ja", wording: WORDING }), undefined);
});

test("wording without the placeholder is used as it is", () => {
  const translated = postTranslation(japanese, { pageLanguage: "en", mainLanguage: "en", wording: "In English" });
  assert.equal(translated?.label, "In English");
});
