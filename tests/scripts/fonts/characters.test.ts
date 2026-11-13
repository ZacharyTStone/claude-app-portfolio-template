import assert from "node:assert/strict";
import { test } from "node:test";
import {
  builtPagesIn,
  isJapaneseLanguage,
  sansCharacters,
  serifCharacters,
} from "../../../scripts/fonts/characters.ts";
import { scratchFolders } from "../scratch-folders.ts";

/** A page in Japanese with this in its body, as the build writes one. */
const japanesePage = (body: string, htmlAttributes = ""): string =>
  `<!doctype html><html lang="ja" dir="ltr"${htmlAttributes}><head><title>題名</title></head><body>${body}</body></html>`;
const englishPage = (body: string): string => `<!doctype html><html lang="en"><body>${body}</body></html>`;

const sansOf = (japanese: string, notFound?: string): string => sansCharacters({ japanese, notFound }).join("");
const serifOf = (japanese: string, notFound?: string): string => serifCharacters({ japanese, notFound }).join("");

test("A language code is Japanese with or without a region, and not when it only starts the same", () => {
  assert.deepEqual(["ja", "ja-JP", "JA", "jam", "en"].map(isJapaneseLanguage), [true, true, true, false, false]);
});

test("The sans needs every character after ASCII in the page's body, each once and in order", () => {
  assert.equal(sansOf(japanesePage("<p>メモ、Notes と メモ</p>")), "、とメモ");
});

test("The sans doesn't need what the page's head says", () => {
  assert.doesNotMatch(sansOf(japanesePage("<p>本</p>")), /[題名]/);
});

test("Spaces and emoji need no font", () => {
  assert.equal(sansOf(japanesePage("<p>左\u3000右\u00a0👋🏽 👩‍💻</p>")), "右左");
});

test("The sans needs the wording data-* attributes hold for the script to show, wherever they are", () => {
  const page = japanesePage('<main data-copied="コピー"><p>本</p></main>', ' data-close="閉"');
  assert.equal(sansOf(page), "コピー本閉");
});

test("The sans doesn't need what other attributes say", () => {
  assert.equal(sansOf(japanesePage('<img alt="写真"><p title="題">本</p>')), "本");
});

test("The sans needs the strings in the page's JSON data, at any depth, and not their keys", () => {
  const data = JSON.stringify({ 鍵: "値", steps: [{ label: "一" }, ["二"]], count: 3 });
  assert.equal(sansOf(japanesePage(`<script type="application/json" id="card">${data}</script>`)), "一二値");
});

test("The sans doesn't need what a script that isn't data says", () => {
  assert.equal(sansOf(japanesePage('<p>本</p><script type="module">const 変数 = "文字";</script>')), "本");
});

test("A character written as its number is read as the character", () => {
  assert.equal(sansOf(japanesePage('<p data-greet-morning="&#12354;">&#x3044;</p>')), "あい");
});

test("The sans needs the lines of an English 404 page that are marked as Japanese", () => {
  const notFound = englishPage('<p>Nothing here.</p><p class="intro" lang="ja">何もありません。</p><p>Désolé</p>');
  assert.equal(sansOf(japanesePage("<p>本</p>"), notFound), "。あせまもりん何本");
});

test("The sans needs all a Japanese 404 page shows", () => {
  const notFound = japanesePage('<p data-back="戻る">何もない</p>');
  assert.equal(sansOf(japanesePage("<p>本</p>"), notFound), "いなもる何戻本");
});

test("The serif needs only what the serif's classes set", () => {
  const page = japanesePage('<h1 class="hello" id="hello">こんにちは。</h1><p class="intro">本文</p>');
  assert.equal(serifOf(page), "。こちにはん");
});

test("The serif's class is found among an element's others, and not in a class that only contains it", () => {
  const page = japanesePage('<div class="hello-wrap">外</div><span class="name wordmark big">中</span>');
  assert.equal(serifOf(page), "中");
});

test("The serif needs the greetings and the goodbye's title the script shows later", () => {
  const page = japanesePage('<div data-greet-evening="晩" data-bye-title="又" data-tagline="他">本</div>');
  assert.equal(serifOf(page), "又晩");
});

test("The serif needs a 404 page's serif text only when that page is in Japanese", () => {
  const japanese = japanesePage('<h1 class="hello">甲</h1>');
  assert.equal(serifOf(japanese, englishPage('<h1 class="hello" lang="ja">乙</h1>')), "甲");
  assert.equal(serifOf(japanese, japanesePage('<h1 class="hello">乙</h1>')), "乙甲");
});

/** A built site with these pages, by their path in it. */
const builtSite = scratchFolders("fonts-test-");

test("The Japanese page is the home page when that's in Japanese", () => {
  const site = builtSite("home", { "index.html": japanesePage("家"), "en/index.html": englishPage("home") });
  assert.equal(builtPagesIn(site)?.japanese, japanesePage("家"));
});

test("Otherwise it's the first language's page that's in Japanese, by its folder's name", () => {
  const site = builtSite("second", {
    "index.html": englishPage("home"),
    "assets/index.html": englishPage("not a language"),
    "ja/index.html": japanesePage("一"),
    "ja-JP/index.html": japanesePage("二"),
  });
  assert.equal(builtPagesIn(site)?.japanese, japanesePage("一"));
});

test("A site built with no Japanese page has no pages to cut fonts for", () => {
  assert.equal(builtPagesIn(builtSite("english", { "index.html": englishPage("home") })), undefined);
});

test("The 404 page comes with the Japanese page when the site has one", () => {
  const without = builtSite("no-404", { "index.html": japanesePage("家") });
  const withOne = builtSite("404", { "index.html": japanesePage("家"), "404.html": englishPage("gone") });
  assert.equal(builtPagesIn(without)?.notFound, undefined);
  assert.equal(builtPagesIn(withOne)?.notFound, englishPage("gone"));
});
