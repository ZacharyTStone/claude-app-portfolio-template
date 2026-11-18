/* The Writing tab's Atom feed (src/site/files/writing-feed.ts), as the build
   writes it for the sample site, and for sites with and without the tab. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { XMLParser } from "fast-xml-parser";
import {
  hasWritingFeed,
  writingFeedPath,
  writingFeedTitle,
  writingFeedXml,
} from "../../../src/site/files/writing-feed.ts";
import { makeSite } from "../../../src/site/site.ts";
import { samplePosts } from "../../sample/writing.ts";
import { sampleConfig } from "../sample.ts";

const posts = await samplePosts();
const site = makeSite(sampleConfig(), posts);
const BUILT_AT = new Date("2026-11-18T00:00:00Z");

/** The feed, read back as XML, its entries always a list. */
const read = (xml: string) =>
  new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", isArray: (name) => name === "entry" }).parse(xml)
    .feed;

test("the feed is beside the Writing tab's page, under the site's path, and named for the owner and the tab", () => {
  assert.equal(writingFeedPath(site), "/writing/feed.xml");
  assert.equal(site.fileUrl(writingFeedPath(site)), "https://example.com/portfolio/writing/feed.xml");
  assert.equal(writingFeedTitle(site), `${site.config.name}: ${site.language(site.main).strings.writingTitle}`);
});

test("it lists every post as the tab does, newest first: its title, its link where it was posted, when and its tags", () => {
  const feed = read(writingFeedXml(site, BUILT_AT));
  assert.deepEqual(
    feed.entry.map((entry: Record<string, Record<string, string>>) => entry["link"]?.["@href"]),
    posts.map((post) => post.url),
  );
  const [first] = posts;
  assert.ok(first);
  assert.equal(feed.entry[0].published, first.posted);
  assert.deepEqual(
    [feed.entry[0].category].flat().map((category: Record<string, string>) => category["@term"]),
    first.tags,
  );
  assert.equal(feed.updated, first.posted);
});

test("it says nothing of a post's text, and marks a title in Japanese as that", () => {
  const xml = writingFeedXml(site, BUILT_AT);
  assert.ok(
    posts.some((post) => post.body),
    "the sample keeps a post's text, for its viewer",
  );
  for (const post of posts) if (post.body) assert.ok(!xml.includes(post.body.slice(0, 20)));
  assert.match(xml, /<title xml:lang="ja">Astroで静的サイトを組み立てる<\/title>/);
});

test("a title can't end the element it's written in", () => {
  const [first] = posts;
  assert.ok(first);
  const xml = writingFeedXml(makeSite(sampleConfig(), [{ ...first, title: `A & B </title><script>` }]), BUILT_AT);
  assert.ok(xml.includes("<title>A &amp; B &lt;/title&gt;&lt;script&gt;</title>"));
});

test("a site without the tab has no feed, and one whose tab is there before the first post has an empty one", () => {
  assert.equal(hasWritingFeed(makeSite(sampleConfig({ writing: undefined }), posts)), false);
  assert.equal(hasWritingFeed(makeSite(sampleConfig(), [])), false);
  const waiting = makeSite(sampleConfig({ writing: { qiita: "sam-sample", showWhenEmpty: true } }), []);
  assert.equal(hasWritingFeed(waiting), true);
  const feed = read(writingFeedXml(waiting, BUILT_AT));
  assert.equal(feed.entry, undefined);
  assert.equal(feed.updated, BUILT_AT.toISOString());
});
