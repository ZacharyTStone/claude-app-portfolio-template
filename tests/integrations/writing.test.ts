/* Fetching the Writing tab's posts as a build starts
   (src/integrations/writing.ts): how Qiita is asked, what's said, and what
   becomes of a failure. A build of each kind is in tests/build. */
import assert from "node:assert/strict";
import { relative } from "node:path";
import { test } from "node:test";
import type { Writing } from "../../src/config/writing.ts";
import { fetchPosts, qiitaFetch } from "../../src/integrations/writing.ts";
import { ROOT } from "../../src/site/repo.ts";
import { WRITING_FIXTURE } from "../../src/site/writing/fixture.ts";
import { qiitaItemsAddress } from "../../src/site/writing/qiita.ts";
import { SAMPLE_QIITA, SAMPLE_QIITA_WITH_NO_POSTS, sampleFixture } from "../sample/qiita.ts";

/** A logger that keeps what it's told. */
function logger() {
  const said: string[] = [];
  const log = {
    info: (message: string) => said.push(`info: ${message}`),
    warn: (message: string) => said.push(`warn: ${message}`),
    error: (message: string) => said.push(`error: ${message}`),
  };
  return { said, log };
}

const FIXTURE_FROM_THE_ROOT = relative(ROOT, SAMPLE_QIITA);

test("without WRITING_FIXTURE, Qiita is asked over the network, and nothing is said of it", () => {
  const { said, log } = logger();
  assert.equal(qiitaFetch({}, log), fetch);
  assert.deepEqual(said, []);
});

test("with WRITING_FIXTURE, the file it names stands in for Qiita, and the build says so", async () => {
  const { said, log } = logger();
  const fetchFromTheFixture = qiitaFetch({ [WRITING_FIXTURE]: FIXTURE_FROM_THE_ROOT }, log);
  const answer = await fetchFromTheFixture(qiitaItemsAddress(sampleFixture().user, 1, 100), {});
  assert.deepEqual(await answer.json(), sampleFixture().items);
  assert.deepEqual(said, [
    `warn: the Writing tab's posts are the fixture ${FIXTURE_FROM_THE_ROOT}, not Qiita's, since ${WRITING_FIXTURE} names it`,
  ]);
});

/** The sample's own `writing`, unless a test gives another. */
const sampleWriting = (writing: Partial<Writing> = {}): Writing => ({ qiita: sampleFixture().user, ...writing });

test("the posts fetched are said, by how many and whose", async () => {
  const { said, log } = logger();
  const posts = await fetchPosts(sampleWriting(), () => qiitaFetch({ [WRITING_FIXTURE]: SAMPLE_QIITA }, log), log);
  assert.ok(Array.isArray(posts));
  assert.equal(said.at(-1), `info: the Writing tab lists ${posts.length} posts by ${sampleFixture().user} on Qiita`);
});

test("on a site whose viewer shows its posts, each is fetched with its text, and what's said says each has a page", async () => {
  const { said, log } = logger();
  const fromTheFixture = () => qiitaFetch({ [WRITING_FIXTURE]: SAMPLE_QIITA }, log);
  const posts = await fetchPosts(sampleWriting({ viewer: true }), fromTheFixture, log);
  assert.ok(Array.isArray(posts) && posts.length > 0);
  assert.ok(posts.every((post) => post.body));
  assert.equal(
    said.at(-1),
    `info: the Writing tab lists ${posts.length} posts by ${sampleFixture().user} on Qiita, each with a page of its own for the viewer (writing.viewer)`,
  );
});

test("on any other site, nothing of a post's text is fetched into the build", async () => {
  const { log } = logger();
  const posts = await fetchPosts(sampleWriting(), () => qiitaFetch({ [WRITING_FIXTURE]: SAMPLE_QIITA }, log), log);
  assert.ok(Array.isArray(posts) && posts.length > 0);
  assert.ok(posts.every((post) => !("body" in post)));
});

test("with no posts yet, what's said is that the site has no Writing tab until the first", async () => {
  const { said, log } = logger();
  const fromNoPosts = () => qiitaFetch({ [WRITING_FIXTURE]: SAMPLE_QIITA_WITH_NO_POSTS }, log);
  assert.deepEqual(await fetchPosts(sampleWriting(), fromNoPosts, log), []);
  assert.equal(
    said.at(-1),
    `info: ${sampleFixture().user} has no public posts on Qiita yet, so the site has no Writing tab until the first`,
  );
});

test("with no posts yet, on a site whose tab shows even then, what's said is that the tab says so", async () => {
  const { said, log } = logger();
  const fromNoPosts = () => qiitaFetch({ [WRITING_FIXTURE]: SAMPLE_QIITA_WITH_NO_POSTS }, log);
  await fetchPosts(sampleWriting({ showWhenEmpty: true }), fromNoPosts, log);
  assert.equal(
    said.at(-1),
    `info: ${sampleFixture().user} has no public posts on Qiita yet, and the Writing tab says so (writing.showWhenEmpty)`,
  );
});

test("posts that can't be fetched are none, and why is what's said instead", async () => {
  const { said, log } = logger();
  const someoneElse = sampleWriting({ qiita: "someone-else" });
  const why = await fetchPosts(someoneElse, () => qiitaFetch({ [WRITING_FIXTURE]: SAMPLE_QIITA }, log), log);
  assert.equal(why, `Qiita has no user by that id (not_found), at ${qiitaItemsAddress("someone-else", 1, 100)}`);
  assert.ok(!said.some((line) => line.startsWith("info:")));
});

test("a fixture that isn't there is a failure like any other, not a crash", async () => {
  const { log } = logger();
  const why = await fetchPosts(sampleWriting(), () => qiitaFetch({ [WRITING_FIXTURE]: "no/such/file.json" }, log), log);
  assert.match(String(why), /ENOENT/);
});
