/* A post's own page on the site (src/site/writing/post-pages.ts): which
   posts have one, where it is, and what it's marked as. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { WRITING_TAB } from "../../../src/config/writing.ts";
import { tabPath } from "../../../src/site/pages.ts";
import { makeSite } from "../../../src/site/site.ts";
import { postBlocks } from "../../../src/site/writing/body.ts";
import { postPages } from "../../../src/site/writing/post-pages.ts";
import { samplePosts } from "../../sample/qiita.ts";
import { sampleConfig, sampleInEnglishOnly } from "../sample.ts";

const posts = await samplePosts();
const site = makeSite(sampleConfig(), posts);
const pages = postPages(site);

test("the sample's viewer shows its posts, so each has a page, in the tab's order", () => {
  assert.equal(site.config.writing?.viewer, true);
  assert.ok(posts.length > 1, "the sample has posts");
  assert.deepEqual(
    pages.map((page) => page.post),
    posts,
  );
});

test("a post's page is under the Writing tab's page in the main language, by the post's id", () => {
  const tabsPage = tabPath(site, site.main, WRITING_TAB);
  assert.deepEqual(
    pages.map((page) => page.path),
    posts.map((post) => `${tabsPage}${post.id}/`),
  );
});

test("a post's page has the post's text, read into parts", () => {
  for (const { post, blocks } of pages) assert.deepEqual(blocks, postBlocks(post.body ?? ""));
  assert.ok(pages.every((page) => page.blocks.length > 0));
});

test("a post in Japanese is marked as that, and any other as in the site's main language", () => {
  const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
  const expected = posts.map((post) => (japanese.test(`${post.title}${post.body}`) ? "ja" : site.main));
  assert.deepEqual(
    pages.map((page) => page.lang),
    expected,
  );
  assert.deepEqual([...new Set(expected)].sort(), [site.main, "ja"].sort(), "the sample has a post of each");
});

test("a site in one language has the same pages, at the same addresses", () => {
  assert.deepEqual(
    postPages(makeSite(sampleInEnglishOnly(), posts)).map((page) => page.path),
    pages.map((page) => page.path),
  );
});

test("a site whose posts open in a new tab has no page for any, even with their text", () => {
  const inANewTab = makeSite(sampleConfig({ writing: { qiita: "sam-sample" } }), posts);
  assert.deepEqual(postPages(inANewTab), []);
});

test("a site without a Writing tab has no page for a post", () => {
  assert.deepEqual(postPages(makeSite(sampleConfig({ writing: undefined }), posts)), []);
});

test("a post whose text the build didn't keep has no page", () => {
  const withoutTheirText = posts.map(({ body: _notKept, ...post }) => post);
  assert.deepEqual(postPages(makeSite(sampleConfig(), withoutTheirText)), []);
});
