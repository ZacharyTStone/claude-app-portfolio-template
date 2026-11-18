/* A DEV user's articles as the build asks for them (src/site/writing/dev.ts),
   with DEV stood in for: what's kept, the pages followed, and the user asked
   for first, since DEV answers an empty list for a name it doesn't have. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { devArticlesAddress, devPosts, devUserAddress } from "../../../src/site/writing/dev.ts";
import type { Post } from "../../../src/site/writing/post.ts";
import { NO_WAIT, placeAnswering } from "./stand-in.ts";

const USER = "sam-sample";

/** An article as DEV's API writes one: the `n`th newest, of `user`'s. */
const article = (n: number, changes: Record<string, unknown> = {}) => ({
  type_of: "article",
  id: n,
  title: `Article ${n}`,
  url: `https://dev.to/${USER}/article-${n}`,
  published_timestamp: new Date(Date.UTC(2026, 9, 30 - n, 12)).toISOString(),
  public_reactions_count: n * 10,
  tag_list: ["webdev", "testing"],
  user: { username: USER, name: "Sam" },
  ...changes,
});

const theUser = Response.json({ username: USER });

const postsOf = (answers: Parameters<typeof placeAnswering>[0], perPage?: number) => {
  const place = placeAnswering(answers);
  const options = { fetch: place.fetch, timeZone: "UTC", retryAfterMs: NO_WAIT, perPage };
  return { posts: devPosts(USER, options), asked: place.asked };
};

test("an article keeps its title, its link on DEV, when it was posted, its reactions as likes and its tags", async () => {
  const { posts } = postsOf({
    [devUserAddress(USER)]: theUser,
    [devArticlesAddress(USER, 1)]: Response.json([article(1)]),
  });
  const expected: Post[] = [
    {
      id: "dev-1",
      title: "Article 1",
      url: `https://dev.to/${USER}/article-1`,
      posted: "2026-10-29T12:00:00+00:00",
      place: "DEV",
      likes: { count: 10 },
      tags: ["webdev", "testing"],
    },
  ];
  assert.deepEqual(await posts, expected);
});

test("the pages are followed until one comes back short, and the newest comes first", async () => {
  const { posts, asked } = postsOf(
    {
      [devUserAddress(USER)]: theUser,
      [devArticlesAddress(USER, 1, 2)]: Response.json([article(3), article(1)]),
      [devArticlesAddress(USER, 2, 2)]: Response.json([article(2)]),
    },
    2,
  );
  assert.deepEqual(
    (await posts).map((post) => post.title),
    ["Article 1", "Article 2", "Article 3"],
  );
  assert.equal(asked.length, 3);
});

test("a build asks for a thousand articles a page, the most DEV gives", async () => {
  const { posts, asked } = postsOf({
    [devUserAddress(USER)]: theUser,
    [devArticlesAddress(USER, 1)]: Response.json([]),
  });
  await posts;
  assert.equal(asked[1]?.address, `https://dev.to/api/articles?username=${USER}&per_page=1000&page=1`);
});

test("a user DEV doesn't have stops it, though DEV would list their articles as none", async () => {
  const { posts } = postsOf({ [devArticlesAddress(USER, 1)]: Response.json([]) });
  await assert.rejects(posts, { message: `DEV has no user by that name, at ${devUserAddress(USER)}` });
});

for (const [wrong, changes, where] of [
  ["a link off DEV", { url: "https://example.com/article-1" }, "0.url"],
  ["a time that isn't one", { published_timestamp: "soon" }, "0.published_timestamp"],
  ["tags that aren't a list", { tag_list: "webdev, testing" }, "0.tag_list"],
] as const) {
  test(`an article with ${wrong} stops it, saying where`, async () => {
    const { posts } = postsOf({
      [devUserAddress(USER)]: theUser,
      [devArticlesAddress(USER, 1)]: Response.json([article(1, changes)]),
    });
    await assert.rejects(posts, (error: Error) => {
      assert.match(error.message, /^DEV's answer isn't a list of articles \(/);
      assert.ok(error.message.includes(`(${where}: `), error.message);
      return true;
    });
  });
}

test("a list with anyone else's article in it stops it, saying so", async () => {
  const { posts } = postsOf({
    [devUserAddress(USER)]: theUser,
    [devArticlesAddress(USER, 1)]: Response.json([article(1, { user: { username: "someone-else" } })]),
  });
  await assert.rejects(posts, /^Error: DEV's list of sam-sample's articles has someone else's in it, at /);
});
