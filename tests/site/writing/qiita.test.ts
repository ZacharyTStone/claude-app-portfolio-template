/* A Qiita user's posts as the build asks for them (src/site/writing/qiita.ts),
   with Qiita stood in for: what's kept of its answer, the pages followed, and
   each way it can fail. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Fetch } from "../../../src/site/fetching.ts";
import { fixtureFetch } from "../../../src/site/writing/fixture.ts";
import type { Post } from "../../../src/site/writing/post.ts";
import { qiitaItemsAddress, qiitaPosts } from "../../../src/site/writing/qiita.ts";
import { sampleFixture, samplePosts } from "../../sample/writing.ts";

const USER = "sam-sample";

/** A test has no time to wait before a request is tried again. */
const NO_WAIT = 0;

/** An item as Qiita's API writes one: the `n`th newest. */
const item = (n: number, changes: Record<string, unknown> = {}) => ({
  id: `item${n}`,
  title: `Post ${n}`,
  url: `https://qiita.com/${USER}/items/item${n}`,
  body: "The body.",
  rendered_body: "<p>The body.</p>",
  created_at: new Date(Date.UTC(2026, 9, 30 - n)).toISOString(),
  updated_at: new Date(Date.UTC(2026, 9, 30 - n)).toISOString(),
  likes_count: n,
  tags: [{ name: "TypeScript", versions: [] }],
  private: false,
  ...changes,
});

const items = (count: number) => Array.from({ length: count }, (_, index) => item(index + 1));

/** Qiita, stood in for: each request gets the next of `answers` (an Error
    is thrown, as fetch() throws), and is kept in `asked`. */
function qiitaAnswering(...answers: Array<Response | Error>) {
  const asked: Array<{ address: string; init: RequestInit }> = [];
  const fetch: Fetch = async (address, init) => {
    asked.push({ address, init });
    const answer = answers[asked.length - 1] ?? answers.at(-1);
    if (answer instanceof Error) throw answer;
    if (!answer) throw new Error("the test gave Qiita nothing to say");
    return answer.clone();
  };
  return { fetch, asked };
}

/** What Qiita sends with a refusal. */
const refusal = (status: number, type: string) => Response.json({ message: type, type }, { status });

/** Throws the error fetch() throws when there's no connection. */
const noConnection = () => new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND qiita.com") });

const postsOf = (fetch: Fetch, perPage?: number) => qiitaPosts(USER, { fetch, perPage, retryAfterMs: NO_WAIT });

/** The sample's posts, of the tests' stand-in for Qiita: with each one's
    text, or, as on a site whose viewer doesn't show its posts, without. */
const fromTheSample = (bodies?: boolean) => qiitaPosts(USER, { fetch: fixtureFetch(sampleFixture()), bodies });

/** An item of the fixture's, as far as these tests read one. */
type FixtureItem = { id: string; title: string; body: string; rendered_body?: string; private: boolean };

const fixtureItems = () => (sampleFixture().qiita?.posts ?? []) as FixtureItem[];

test("a post keeps its id, its title, its link, when it was posted, its place, its LGTMs and its tags, and nothing of its body", async () => {
  const expected: Post[] = [
    {
      id: "c0ffee0000000000c0f1",
      title: "Astroで静的サイトを組み立てる",
      url: "https://qiita.com/sam-sample/items/c0ffee0000000000c0f1",
      posted: "2026-10-01T09:30:00+09:00",
      place: "Qiita",
      likes: { count: 12, word: "LGTM" },
      tags: ["Astro", "TypeScript"],
    },
    {
      id: "c0ffee0000000000c0f3",
      title: "Testing a static site in Playwright",
      url: "https://qiita.com/sam-sample/items/c0ffee0000000000c0f3",
      posted: "2026-06-15T18:00:00+09:00",
      place: "Qiita",
      likes: { count: 3, word: "LGTM" },
      tags: ["Playwright"],
    },
  ];
  assert.deepEqual(await fromTheSample(), expected);
});

test("for a site whose viewer shows its posts, a post keeps its text too, as its author wrote it", async () => {
  const written = new Map(fixtureItems().map(({ id, body }) => [id, body]));
  const posts = await fromTheSample(true);
  assert.ok(posts.length, "the fixture has public posts");
  assert.deepEqual(
    posts.map((post) => post.body),
    posts.map((post) => written.get(post.id)),
  );
  assert.ok(posts.every((post) => post.body));
});

test("Qiita's own HTML of a post is never kept, with the post's text or without", async () => {
  const qiitasHtml = fixtureItems().flatMap((each) => each.rendered_body ?? []);
  assert.ok(qiitasHtml.length, "the fixture has a post as Qiita's HTML");
  for (const posts of [await fromTheSample(), await fromTheSample(true)]) {
    const kept = JSON.stringify(posts);
    assert.deepEqual(
      qiitasHtml.filter((html) => kept.includes(html)),
      [],
    );
  }
});

test("a post shared by link only (private) is left out", async () => {
  const privateOnes = fixtureItems().filter((each) => each.private);
  assert.equal(privateOnes.length, 1, "the fixture has a private post");
  const posts = await samplePosts();
  assert.ok(!posts.some((post) => post.title === privateOnes[0]?.title));
});

test("the newest comes first, whatever order Qiita sends them in", async () => {
  const { fetch } = qiitaAnswering(Response.json([item(3), item(1), item(2)]));
  assert.deepEqual(
    (await postsOf(fetch)).map((post) => post.title),
    ["Post 1", "Post 2", "Post 3"],
  );
});

test("the pages are followed until one comes back short, and every post on them is kept", async () => {
  const fixture = { qiita: { user: USER, posts: items(5) }, feeds: {} };
  const asked: string[] = [];
  const fetch: Fetch = (address, init) => {
    asked.push(address);
    return fixtureFetch(fixture)(address, init);
  };
  assert.equal((await postsOf(fetch, 2)).length, 5);
  assert.deepEqual(
    asked,
    [1, 2, 3].map((page) => qiitaItemsAddress(USER, page, 2)),
  );
});

test("a last page that's full is followed by one more, which comes back empty", async () => {
  const { fetch, asked } = qiitaAnswering(Response.json(items(2)), Response.json([]));
  assert.equal((await postsOf(fetch, 2)).length, 2);
  assert.equal(asked.length, 2);
});

test("a build asks for a hundred posts a page, each request with a time limit", async () => {
  const { fetch, asked } = qiitaAnswering(Response.json(items(1)));
  await qiitaPosts(USER, { fetch });
  assert.equal(asked[0]?.address, `https://qiita.com/api/v2/users/${USER}/items?page=1&per_page=100`);
  assert.ok(asked[0]?.init.signal instanceof AbortSignal);
});

test("a user Qiita doesn't have stops it at once, saying so and where", async () => {
  const fetch = fixtureFetch({ qiita: { user: "someone-else", posts: items(1) }, feeds: {} });
  await assert.rejects(postsOf(fetch), {
    message: `Qiita has no user by that id (not_found), at ${qiitaItemsAddress(USER, 1, 100)}`,
  });
});

test("a server error is tried once more, and the second answer is the one that counts", async () => {
  const { fetch, asked } = qiitaAnswering(refusal(503, "service_unavailable"), Response.json(items(1)));
  assert.equal((await postsOf(fetch)).length, 1);
  assert.equal(asked.length, 2);
});

test("a server that fails twice stops it, saying how", async () => {
  const { fetch, asked } = qiitaAnswering(new Response("Bad gateway", { status: 502 }));
  await assert.rejects(postsOf(fetch), /^Error: Qiita answered 502, at https:\/\/qiita\.com\//);
  assert.equal(asked.length, 2);
});

test("no connection, twice, stops it, saying why", async () => {
  const { fetch, asked } = qiitaAnswering(noConnection());
  await assert.rejects(postsOf(fetch), {
    message: `Qiita couldn't be reached: fetch failed (getaddrinfo ENOTFOUND qiita.com), at ${qiitaItemsAddress(USER, 1, 100)}`,
  });
  assert.equal(asked.length, 2);
});

test("no answer in time, twice, stops it, saying so", async () => {
  const { fetch, asked } = qiitaAnswering(new DOMException("The operation timed out.", "TimeoutError"));
  await assert.rejects(postsOf(fetch), /^Error: no answer in 10 seconds, at /);
  assert.equal(asked.length, 2);
});

test("a refusal that another try wouldn't change (too many requests in the hour) isn't tried again", async () => {
  const { fetch, asked } = qiitaAnswering(refusal(403, "rate_limit_exceeded"));
  await assert.rejects(postsOf(fetch), /^Error: Qiita answered 403 \(rate_limit_exceeded\), at /);
  assert.equal(asked.length, 1);
});

for (const [wrong, answer, where] of [
  ["an object, not a list", { items: [] }, "the answer"],
  ["a post whose id couldn't be one part of an address", [item(1, { id: "../item1" })], "0.id"],
  ["a post without a title", [item(1, { title: "  " })], "0.title"],
  ["a post whose text isn't text", [item(1, { body: { html: "<p>The body.</p>" } })], "0.body"],
  ["a post that links to another site", [item(1, { url: "https://example.com/items/1" })], "0.url"],
  ["a post whose date isn't one", [item(1, { created_at: "yesterday" })], "0.created_at"],
  ["a post with LGTMs that aren't a count", [item(1, { likes_count: -1 })], "0.likes_count"],
  ["a post that doesn't say whether it's private", [item(1, { private: undefined })], "0.private"],
] as const) {
  test(`an answer with ${wrong} stops it, saying where, and isn't asked for again`, async () => {
    const { fetch, asked } = qiitaAnswering(Response.json(answer));
    await assert.rejects(postsOf(fetch), (error: Error) => {
      assert.match(error.message, /^Qiita's answer isn't a list of posts as its API sends one \(/);
      assert.ok(error.message.includes(`(${where}: `), error.message);
      return true;
    });
    assert.equal(asked.length, 1);
  });
}

test("an answer that isn't JSON stops it, as one that isn't a list of posts", async () => {
  const { fetch } = qiitaAnswering(new Response("<html>Maintenance</html>", { status: 200 }));
  await assert.rejects(postsOf(fetch), /isn't a list of posts/);
});
