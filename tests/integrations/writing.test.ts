/* Fetching the Writing tab's posts as a build starts
   (src/integrations/writing.ts): how Qiita is asked, what's said, and what
   becomes of a failure. A build of each kind is in tests/build. */
import assert from "node:assert/strict";
import { relative } from "node:path";
import { test } from "node:test";
import { fetchPosts, qiitaFetch } from "../../src/integrations/writing.ts";
import { ROOT } from "../../src/site/repo.ts";
import { WRITING_FIXTURE } from "../../src/site/writing/fixture.ts";
import { qiitaItemsAddress } from "../../src/site/writing/qiita.ts";
import { SAMPLE_QIITA, sampleFixture } from "../sample/qiita.ts";

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

test("the posts fetched are said, by how many and whose", async () => {
  const { said, log } = logger();
  const posts = await fetchPosts(sampleFixture().user, () => qiitaFetch({ [WRITING_FIXTURE]: SAMPLE_QIITA }, log), log);
  assert.ok(Array.isArray(posts));
  assert.equal(said.at(-1), `info: the Writing tab lists ${posts.length} posts by ${sampleFixture().user} on Qiita`);
});

test("posts that can't be fetched are none, and why is what's said instead", async () => {
  const { said, log } = logger();
  const why = await fetchPosts("someone-else", () => qiitaFetch({ [WRITING_FIXTURE]: SAMPLE_QIITA }, log), log);
  assert.equal(why, `Qiita has no user by that id (not_found), at ${qiitaItemsAddress("someone-else", 1, 100)}`);
  assert.ok(!said.some((line) => line.startsWith("info:")));
});

test("a fixture that isn't there is a failure like any other, not a crash", async () => {
  const { log } = logger();
  const why = await fetchPosts("sam-sample", () => qiitaFetch({ [WRITING_FIXTURE]: "no/such/file.json" }, log), log);
  assert.match(String(why), /ENOENT/);
});
