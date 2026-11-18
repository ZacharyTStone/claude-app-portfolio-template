/* A blog's posts from its RSS or Atom feed (src/site/writing/feeds.ts,
   feed-xml.ts), with the blog stood in for: the three kinds of feed read,
   the platforms' feeds named by account, what's kept, and each way a feed
   can be refused. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Writing } from "../../../src/config/writing.ts";
import { readFeed } from "../../../src/site/writing/feed-xml.ts";
import { feedPosts, feedsOf, type Feed } from "../../../src/site/writing/feeds.ts";
import { NO_WAIT, placeAnswering } from "./stand-in.ts";

const BLOG = "https://blog.example.com/feed.xml";

const rss = (items: string, link = "https://blog.example.com/") =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Sam's blog</title><link>${link}</link>${items}</channel></rss>`;

const rssItem = ({
  title = "A post",
  link = "https://blog.example.com/a-post",
  date = "Sat, 04 Jul 2026 07:30:00 +0900",
  extra = "",
} = {}) => `<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate>${extra}</item>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Sam's diary</title>
  <link href="https://sam.hatenablog.com/"/>
  <entry>
    <title>日記を書きました</title>
    <link href="https://sam.hatenablog.com/entry/2026/11/04/112559"/>
    <link rel="enclosure" href="https://cdn.example.com/og.png"/>
    <published>2026-11-04T11:25:59+09:00</published>
    <category term="日記" label="日記"/>
    <content type="html">&lt;p&gt;Never read&lt;/p&gt;</content>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel><title>An old blog</title><link>https://old.example.jp/</link></channel>
  <item><title>Old post</title><link>https://old.example.jp/blog-entry-1.html</link><dc:date>2010-05-01T10:00:00+09:00</dc:date><dc:subject>misc</dc:subject></item>
</rdf:RDF>`;

const feed = (changes: Partial<Feed> = {}): Feed => ({ key: "feed", url: BLOG, place: "Sam's blog", ...changes });

const postsOf = (theFeed: Feed, text: string | Response) => {
  const place = placeAnswering({ [theFeed.url]: typeof text === "string" ? new Response(text) : text });
  return feedPosts(theFeed, { fetch: place.fetch, timeZone: "Asia/Tokyo", retryAfterMs: NO_WAIT });
};

test("an RSS post keeps its title, its link, when it was posted by the owner's clock, the feed's name and its tags, and nothing of its text", async () => {
  const extra = "<category>life</category><description>&lt;p&gt;Never read&lt;/p&gt;</description>";
  const [post] = await postsOf(feed(), rss(rssItem({ date: "Fri, 03 Jul 2026 22:30:00 GMT", extra })));
  assert.deepEqual(post && { ...post, id: post.id.slice(0, "feed-".length) }, {
    id: "feed-",
    title: "A post",
    url: "https://blog.example.com/a-post",
    posted: "2026-07-04T07:30:00+09:00",
    place: "Sam's blog",
    tags: ["life"],
  });
  assert.doesNotMatch(JSON.stringify(post), /Never read/);
});

test("an Atom post (Hatena Blog's) keeps the link to itself, not its picture, and its categories' terms", async () => {
  const [post] = await postsOf(feed({ url: "https://sam.hatenablog.com/feed", place: "Hatena Blog" }), ATOM);
  assert.deepEqual(post && [post.title, post.url, post.posted, post.tags], [
    "日記を書きました",
    "https://sam.hatenablog.com/entry/2026/11/04/112559",
    "2026-11-04T11:25:59+09:00",
    ["日記"],
  ]);
});

test("an RSS 1.0 (RDF) post keeps its dc:date and dc:subject", async () => {
  const [post] = await postsOf(feed({ url: "https://old.example.jp/index.rdf" }), RDF);
  assert.deepEqual(post && [post.title, post.posted, post.tags], ["Old post", "2010-05-01T10:00:00+09:00", ["misc"]]);
});

test("the newest comes first, a title's entities are read, and each post has an id of its own", async () => {
  const items = [
    rssItem({ title: "Older", link: "https://blog.example.com/1", date: "Mon, 01 Jun 2026 09:00:00 +0900" }),
    rssItem({
      title: "It&#8217;s &amp; newer",
      link: "https://blog.example.com/2",
      date: "Wed, 01 Jul 2026 09:00:00 +0900",
    }),
  ];
  const posts = await postsOf(feed(), rss(items.join("")));
  assert.deepEqual(
    posts.map((post) => post.title),
    ["It’s & newer", "Older"],
  );
  assert.equal(new Set(posts.map((post) => post.id)).size, 2);
  assert.ok(posts.every((post) => /^feed-[0-9a-f]{16}$/.test(post.id)));
});

test("a post may link to a subdomain of the blog's, or to the site the feed says it's for", async () => {
  const items = [
    rssItem({ link: "https://www.blog.example.com/a" }),
    rssItem({ title: "On Ameba", link: "https://ameblo.jp/sam/entry-1.html" }),
  ];
  const posts = await postsOf(
    feed({ url: "https://rssblog.ameba.jp/sam/rss20.xml" }),
    rss(items[1] ?? "", "https://ameblo.jp/sam/"),
  );
  assert.equal(posts[0]?.url, "https://ameblo.jp/sam/entry-1.html");
  assert.equal((await postsOf(feed(), rss(items[0] ?? "")))[0]?.url, "https://www.blog.example.com/a");
});

for (const [wrong, item, problem] of [
  [
    "a link to another site",
    rssItem({ link: "https://example.org/elsewhere" }),
    `a post, "A post", that links to https://example.org/elsewhere, off the blog's own site`,
  ],
  [
    "a link that isn't to a web page",
    rssItem({ link: "javascript:alert(1)" }),
    `a post, "A post", that links to javascript:alert(1), off the blog's own site`,
  ],
  [
    "no link",
    "<item><title>A post</title><pubDate>Sat, 04 Jul 2026 07:30:00 +0900</pubDate></item>",
    `a post, "A post", with no link`,
  ],
  ["no title", "<item><link>https://blog.example.com/a</link></item>", "a post with no title"],
  [
    "a time that isn't one",
    rssItem({ date: "someday" }),
    `a post, "A post", with no time it was posted, or one that isn't a time`,
  ],
] as const) {
  test(`a feed with ${wrong} stops it, saying which post and why`, async () => {
    await assert.rejects(postsOf(feed(), rss(item)), { message: `Sam's blog's feed has ${problem}, at ${BLOG}` });
  });
}

test("Medium's posts may link to a publication's own domain, without the ?source= Medium adds", async () => {
  const [medium] = feedsOf({ medium: "sam" });
  assert.ok(medium);
  const item = rssItem({ link: "https://some-publication.com/a-post-0123?source=rss----abc---4" });
  const [post] = await postsOf(medium, rss(item, "https://medium.com/@sam?source=rss"));
  assert.equal(post?.url, "https://some-publication.com/a-post-0123");
});

test("a feed that isn't one, or that declares entities, is refused unread", async () => {
  await assert.rejects(postsOf(feed(), "<html><body>Maintenance</body></html>"), {
    message: `Sam's blog's feed can't be read: it isn't an RSS or Atom feed, at ${BLOG}`,
  });
  const laughs = `<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "aaaaaaaa">]><rss><channel><item><title>&a;</title></item></channel></rss>`;
  assert.equal(readFeed(laughs), "it declares entities of its own, which no feed needs");
});

test("a feed that isn't there stops it, saying so", async () => {
  await assert.rejects(postsOf(feed(), new Response("Not found", { status: 404 })), {
    message: `Sam's blog has no feed at that address, at ${BLOG}`,
  });
});

test("the platforms are named by account, then the config's own feeds, by their name or their host", () => {
  const writing: Writing = {
    hatena: "sam.hatenablog.com",
    note: "sam_sample",
    medium: "sam",
    substack: "samsample",
    feeds: [{ url: "https://www.blog.example.com/rss/" }, { url: BLOG, name: "Sam's blog" }],
  };
  assert.deepEqual(
    feedsOf(writing).map(({ url, place }) => [url, place]),
    [
      ["https://note.com/sam_sample/rss", "note"],
      ["https://medium.com/feed/@sam", "Medium"],
      ["https://samsample.substack.com/feed", "Substack"],
      ["https://sam.hatenablog.com/feed", "Hatena Blog"],
      ["https://www.blog.example.com/rss/", "blog.example.com"],
      [BLOG, "Sam's blog"],
    ],
  );
});
