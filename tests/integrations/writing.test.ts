/* Fetching the Writing tab's posts as a build starts
   (src/integrations/writing.ts): how the places are asked, what's said, and
   what becomes of a failure. A build of each kind is in tests/build. */
import assert from "node:assert/strict";
import { relative } from "node:path";
import { test } from "node:test";
import type { Writing } from "../../src/config/writing.ts";
import { fetchPosts, writingFetch } from "../../src/integrations/writing.ts";
import { ROOT } from "../../src/site/repo.ts";
import { WRITING_FIXTURE } from "../../src/site/writing/fixture.ts";
import { qiitaItemsAddress } from "../../src/site/writing/qiita.ts";
import { SAMPLE_WRITING, SAMPLE_WRITING_WITH_NO_POSTS, sampleFixture } from "../sample/writing.ts";

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

const FIXTURE_FROM_THE_ROOT = relative(ROOT, SAMPLE_WRITING);

const qiitaUser = (): string => sampleFixture().qiita?.user ?? "";

test("without WRITING_FIXTURE, the places are asked over the network, and nothing is said of it", () => {
  const { said, log } = logger();
  assert.equal(writingFetch({}, log), fetch);
  assert.deepEqual(said, []);
});

test("with WRITING_FIXTURE, the file it names stands in for the places, and the build says so", async () => {
  const { said, log } = logger();
  const fetchFromTheFixture = writingFetch({ [WRITING_FIXTURE]: FIXTURE_FROM_THE_ROOT }, log);
  const answer = await fetchFromTheFixture(qiitaItemsAddress(qiitaUser(), 1, 100), {});
  assert.deepEqual(await answer.json(), sampleFixture().qiita?.posts);
  assert.deepEqual(said, [
    `warn: the Writing tab's posts are the fixture ${FIXTURE_FROM_THE_ROOT}, not the places', since ${WRITING_FIXTURE} names it`,
  ]);
});

/** Qiita alone, as the sample has it, unless a test gives more. */
const qiitaWriting = (writing: Partial<Writing> = {}): Writing => ({ qiita: qiitaUser(), ...writing });

/** How the tests ask: of the fixture `file`, in UTC. */
const askingOf = (file: string, log: ReturnType<typeof logger>["log"]) => ({
  howToAsk: () => writingFetch({ [WRITING_FIXTURE]: file }, log),
  timeZone: "UTC",
});

test("the posts fetched are said, by how many and from where", async () => {
  const { said, log } = logger();
  const posts = await fetchPosts(qiitaWriting({ zenn: "sam_sample" }), askingOf(SAMPLE_WRITING, log), log);
  assert.ok(Array.isArray(posts));
  const onQiita = posts.filter((post) => post.place === "Qiita").length;
  assert.equal(said.at(-1), `info: the Writing tab lists ${posts.length} posts: ${onQiita} on Qiita, 1 on Zenn`);
});

test("on a site whose viewer shows its posts, each Qiita post is fetched with its text, and what's said says each has a page", async () => {
  const { said, log } = logger();
  const posts = await fetchPosts(qiitaWriting({ viewer: true }), askingOf(SAMPLE_WRITING, log), log);
  assert.ok(Array.isArray(posts) && posts.length > 0);
  assert.ok(posts.every((post) => post.body));
  assert.equal(
    said.at(-1),
    `info: the Writing tab lists ${posts.length} posts: ${posts.length} on Qiita, each Qiita post with a page of its own for the viewer (writing.viewer)`,
  );
});

test("on any other site, nothing of a post's text is fetched into the build", async () => {
  const { log } = logger();
  const posts = await fetchPosts(qiitaWriting(), askingOf(SAMPLE_WRITING, log), log);
  assert.ok(Array.isArray(posts) && posts.length > 0);
  assert.ok(posts.every((post) => !("body" in post)));
});

test("with no posts yet, what's said is where, and that the site has no Writing tab until the first", async () => {
  const { said, log } = logger();
  const writing = qiitaWriting({ zenn: "sam_sample", note: "sam_sample" });
  assert.deepEqual(await fetchPosts(writing, askingOf(SAMPLE_WRITING_WITH_NO_POSTS, log), log), []);
  assert.equal(
    said.at(-1),
    `info: there are no public posts on Qiita (${qiitaUser()}), Zenn (sam_sample) and note yet, so the site has no Writing tab until the first`,
  );
});

test("with no posts yet, on a site whose tab shows even then, what's said is that the tab says so", async () => {
  const { said, log } = logger();
  await fetchPosts(qiitaWriting({ showWhenEmpty: true }), askingOf(SAMPLE_WRITING_WITH_NO_POSTS, log), log);
  assert.equal(
    said.at(-1),
    `info: there are no public posts on Qiita (${qiitaUser()}) yet, and the Writing tab says so (writing.showWhenEmpty)`,
  );
});

test("posts that can't be fetched are none, and why is what's said instead", async () => {
  const { said, log } = logger();
  const someoneElse = qiitaWriting({ qiita: "someone-else" });
  const why = await fetchPosts(someoneElse, askingOf(SAMPLE_WRITING, log), log);
  assert.equal(why, `Qiita has no user by that id (not_found), at ${qiitaItemsAddress("someone-else", 1, 100)}`);
  assert.ok(!said.some((line) => line.startsWith("info:")));
});

test("one place that can't be had is none of them: the other places' posts aren't listed alone", async () => {
  const { log } = logger();
  const why = await fetchPosts(qiitaWriting({ zenn: "someone_else" }), askingOf(SAMPLE_WRITING, log), log);
  assert.equal(why, "Zenn has no user by that name, at https://zenn.dev/api/users/someone_else");
});

test("a fixture that isn't there is a failure like any other, not a crash", async () => {
  const { log } = logger();
  const why = await fetchPosts(qiitaWriting(), askingOf("no/such/file.json", log), log);
  assert.match(String(why), /ENOENT/);
});
