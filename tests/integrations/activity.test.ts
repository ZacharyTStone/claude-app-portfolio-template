/* Fetching the panel's GitHub activity as a build starts
   (src/integrations/activity.ts): how GitHub is asked, what's said, and what
   becomes of a failure. A build of each kind is in tests/build. */
import assert from "node:assert/strict";
import { relative } from "node:path";
import { test } from "node:test";
import { fetchRepos, githubFetch } from "../../src/integrations/activity.ts";
import { ACTIVITY_FIXTURE } from "../../src/site/activity/fixture.ts";
import { eventsAddress, GITHUB_TOKEN } from "../../src/site/activity/github.ts";
import { ROOT } from "../../src/site/repo.ts";
import { SAMPLE_GITHUB, sampleGitHub } from "../sample/github.ts";

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

const FIXTURE_FROM_THE_ROOT = relative(ROOT, SAMPLE_GITHUB);
const withTheFixture = { [ACTIVITY_FIXTURE]: SAMPLE_GITHUB };

test("without ACTIVITY_FIXTURE, GitHub is asked over the network, and nothing is said of it", () => {
  const { said, log } = logger();
  assert.equal(githubFetch({}, log), fetch);
  assert.deepEqual(said, []);
});

test("with ACTIVITY_FIXTURE, the file it names stands in for GitHub, and the build says so", async () => {
  const { said, log } = logger();
  const fetchFromTheFixture = githubFetch({ [ACTIVITY_FIXTURE]: FIXTURE_FROM_THE_ROOT }, log);
  const answer = await fetchFromTheFixture(eventsAddress(sampleGitHub().user, 100), {});
  assert.deepEqual(await answer.json(), sampleGitHub().events);
  assert.deepEqual(said, [
    `warn: the panel's GitHub activity is the fixture ${FIXTURE_FROM_THE_ROOT}, not GitHub's, since ${ACTIVITY_FIXTURE} names it`,
  ]);
});

test("the repos fetched are said, by how many and whose", async () => {
  const { said, log } = logger();
  const { user } = sampleGitHub();
  const repos = await fetchRepos(user, withTheFixture, () => githubFetch(withTheFixture, log), log);
  assert.ok(Array.isArray(repos));
  assert.equal(said.at(-1), `info: the panel lists ${repos.length} public repos ${user} pushed to lately on GitHub`);
});

test(`with ${GITHUB_TOKEN} set, the build says it asked with it, and never what it is`, async () => {
  const { said, log } = logger();
  const environment = { ...withTheFixture, [GITHUB_TOKEN]: "a-secret-token" };
  await fetchRepos(sampleGitHub().user, environment, () => githubFetch(environment, log), log);
  assert.match(said.at(-1) ?? "", new RegExp(`, asked with ${GITHUB_TOKEN}$`));
  assert.ok(!said.some((line) => line.includes("a-secret-token")));
});

test("repos that can't be fetched are none, and why is what's said instead", async () => {
  const { said, log } = logger();
  const why = await fetchRepos("someone-else", withTheFixture, () => githubFetch(withTheFixture, log), log);
  assert.equal(why, `GitHub has no user by that name (Not Found), at ${eventsAddress("someone-else", 100)}`);
  assert.ok(!said.some((line) => line.startsWith("info:")));
});

test("a fixture that isn't there is a failure like any other, not a crash", async () => {
  const { log } = logger();
  const missing = { [ACTIVITY_FIXTURE]: "no/such/file.json" };
  const why = await fetchRepos("sam-sample", missing, () => githubFetch(missing, log), log);
  assert.match(String(why), /ENOENT/);
});
