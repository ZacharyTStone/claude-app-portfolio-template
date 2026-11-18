/* A Zenn user's articles as the build asks for them (src/site/writing/zenn.ts),
   with Zenn stood in for: what's kept, the pages followed, the user asked
   for first, and the list that's someone else's. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Post } from "../../../src/site/writing/post.ts";
import { zennArticlesAddress, zennPosts, zennUserAddress } from "../../../src/site/writing/zenn.ts";
import { NO_WAIT, placeAnswering } from "./stand-in.ts";

const USER = "sam_sample";

/** An article as Zenn's API writes one: the `n`th newest, of `user`'s. */
const article = (n: number, changes: Record<string, unknown> = {}) => ({
  id: n,
  post_type: "Article",
  slug: `5a3p1e000000${n}`,
  title: `Article ${n}`,
  path: `/${USER}/articles/5a3p1e000000${n}`,
  published_at: new Date(Date.UTC(2026, 9, 30 - n, 14, 30)).toISOString(),
  liked_count: n,
  article_type: "tech",
  user: { id: 1, username: USER, name: "Sam" },
  ...changes,
});

const theUser = Response.json({ user: { username: USER } });
const page = (articles: unknown[], next: number | null = null) => Response.json({ articles, next_page: next });

const postsOf = (answers: Parameters<typeof placeAnswering>[0], timeZone = "Asia/Tokyo") => {
  const place = placeAnswering(answers);
  return { posts: zennPosts(USER, { fetch: place.fetch, timeZone, retryAfterMs: NO_WAIT }), asked: place.asked };
};

test("an article keeps its title, its link on Zenn, when it was posted by the owner's clock, and its likes", async () => {
  const { posts } = postsOf({
    [zennUserAddress(USER)]: theUser,
    [zennArticlesAddress(USER, 1)]: page([article(1, { published_at: "2026-10-01T16:30:00.000Z" })]),
  });
  const expected: Post[] = [
    {
      id: "zenn-5a3p1e0000001",
      title: "Article 1",
      url: `https://zenn.dev/${USER}/articles/5a3p1e0000001`,
      posted: "2026-10-02T01:30:00+09:00",
      place: "Zenn",
      likes: { count: 1 },
      tags: [],
    },
  ];
  assert.deepEqual(await posts, expected);
});

test("the pages are followed while Zenn names a next one, and the newest comes first", async () => {
  const { posts, asked } = postsOf({
    [zennUserAddress(USER)]: theUser,
    [zennArticlesAddress(USER, 1)]: page([article(3), article(1)], 2),
    [zennArticlesAddress(USER, 2)]: page([article(2)]),
  });
  assert.deepEqual(
    (await posts).map((post) => post.title),
    ["Article 1", "Article 2", "Article 3"],
  );
  assert.equal(asked.length, 3);
});

test("the user is asked for first, and one Zenn doesn't have stops it before any list is asked for", async () => {
  const { posts, asked } = postsOf({});
  await assert.rejects(posts, { message: `Zenn has no user by that name, at ${zennUserAddress(USER)}` });
  assert.equal(asked.length, 1);
});

test("a list with anyone else's article in it, as Zenn sends for a name it ignores, stops it, saying so", async () => {
  const { posts } = postsOf({
    [zennUserAddress(USER)]: theUser,
    [zennArticlesAddress(USER, 1)]: page([article(1), article(2, { user: { username: "someone_else" } })]),
  });
  await assert.rejects(posts, /^Error: Zenn's list of sam_sample's articles has someone else's in it, at /);
});

for (const [wrong, changes, where] of [
  ["a path off Zenn's", { path: "//example.com/articles/x" }, "articles.0.path"],
  ["no title", { title: " " }, "articles.0.title"],
  ["a time that isn't one", { published_at: "yesterday" }, "articles.0.published_at"],
  ["likes that aren't a count", { liked_count: 1.5 }, "articles.0.liked_count"],
] as const) {
  test(`an article with ${wrong} stops it, saying where`, async () => {
    const { posts } = postsOf({
      [zennUserAddress(USER)]: theUser,
      [zennArticlesAddress(USER, 1)]: page([article(1, changes)]),
    });
    await assert.rejects(posts, (error: Error) => {
      assert.match(error.message, /^Zenn's answer isn't a list of articles \(/);
      assert.ok(error.message.includes(`(${where}: `), error.message);
      return true;
    });
  });
}

test("a publication's article is the user's too, under its own path", async () => {
  const { posts } = postsOf({
    [zennUserAddress(USER)]: theUser,
    [zennArticlesAddress(USER, 1)]: page([article(1, { path: "/p/sam_team/articles/5a3p1e0000001" })]),
  });
  assert.equal((await posts)[0]?.url, "https://zenn.dev/p/sam_team/articles/5a3p1e0000001");
});

test("a server error is tried once more, and the second answer is the one that counts", async () => {
  const { posts, asked } = postsOf({
    [zennUserAddress(USER)]: [new Response("Busy", { status: 503 }), theUser],
    [zennArticlesAddress(USER, 1)]: page([article(1)]),
  });
  assert.equal((await posts).length, 1);
  assert.equal(asked.length, 3);
});
