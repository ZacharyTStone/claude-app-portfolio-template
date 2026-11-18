/* Every place `writing` names, asked together (src/site/writing/sources.ts),
   and the time a post was posted, by the owner's clock (posted.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { inTimeZone, postedIn } from "../../../src/site/writing/posted.ts";
import { postsOfEveryPlace, postsPerPlace, sourcesOf } from "../../../src/site/writing/sources.ts";
import { fixtureFetch } from "../../../src/site/writing/fixture.ts";
import { sampleFixture, samplePosts, sampleWriting } from "../../sample/writing.ts";
import { NO_WAIT } from "./stand-in.ts";

test("the sample's posts from Qiita, Zenn and note come together, newest first", async () => {
  const posts = await samplePosts();
  assert.deepEqual(
    posts.map((post) => post.place),
    ["Qiita", "Zenn", "note", "Qiita"],
  );
  assert.deepEqual(
    posts.map((post) => post.posted),
    posts.map((post) => post.posted).toSorted((one, other) => Date.parse(other) - Date.parse(one)),
  );
  assert.equal(postsPerPlace(posts), "2 on Qiita, 1 on Zenn, 1 on note");
});

test("the places are asked in the config's order, each named as what's said names it", () => {
  const writing = { ...sampleWriting(), dev: "sam-sample", feeds: [{ url: "https://blog.example.com/rss" }] };
  assert.deepEqual(
    sourcesOf(writing, { fetch, timeZone: "UTC" }).map((source) => source.name),
    ["Qiita (sam-sample)", "Zenn (sam_sample)", "DEV (sam-sample)", "note", "blog.example.com"],
  );
});

test("with writing.latest, the tab lists only the newest that many, from every place together", async () => {
  const everyPost = await samplePosts();
  const newest = await postsOfEveryPlace(
    { ...sampleWriting(), latest: 2 },
    { fetch: fixtureFetch(sampleFixture()), timeZone: "UTC", retryAfterMs: NO_WAIT },
  );
  assert.deepEqual(
    newest,
    everyPost.slice(0, 2).map(({ body: _kept, ...post }) => post),
  );
});

test("a post two feeds both list is listed once", async () => {
  const fixture = sampleFixture();
  const [note = "", xml = ""] = Object.entries(fixture.feeds)[0] ?? [];
  const copy = "https://mirror.example.com/rss";
  const writing = { feeds: [{ url: note }, { url: copy, name: "A mirror" }] };
  // The copy says it's for note.com, as a mirror of a feed would.
  const withACopy = fixtureFetch({ feeds: { [note]: xml, [copy]: xml } });
  const posts = await postsOfEveryPlace(writing, { fetch: withACopy, timeZone: "UTC", retryAfterMs: NO_WAIT });
  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.place, "note.com");
});

test("a time is written again by the owner's clock, with its offset", () => {
  assert.deepEqual(
    [
      inTimeZone(Date.parse("2026-11-16T15:30:03Z"), "Asia/Tokyo"),
      postedIn("Wed, 28 Jun 2023 18:01:22 GMT", "America/New_York"),
      postedIn("2026-03-08T07:30:00Z", "America/Los_Angeles"),
      postedIn("2026-07-01T00:00:00Z", "Asia/Kolkata"),
      postedIn("2026-01-01T00:00:00Z", "UTC"),
    ],
    [
      "2026-11-17T00:30:03+09:00",
      "2023-06-28T14:01:22-04:00",
      "2026-03-07T23:30:00-08:00",
      "2026-07-01T05:30:00+05:30",
      "2026-01-01T00:00:00+00:00",
    ],
  );
  assert.equal(postedIn("someday", "UTC"), undefined);
});
