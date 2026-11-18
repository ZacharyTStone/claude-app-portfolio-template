/* Fetching the panel's activity as a build starts
   (src/integrations/activity.ts): how the places are asked, what's said,
   and what becomes of a failure. A build of each kind is in tests/build. */
import assert from "node:assert/strict";
import { relative } from "node:path";
import { test } from "node:test";
import { activityFetch, fetchRepos } from "../../src/integrations/activity.ts";
import { feedAddress } from "../../src/site/activity/codeberg.ts";
import { ACTIVITY_FIXTURE } from "../../src/site/activity/fixture.ts";
import { eventsAddress, GITHUB_TOKEN } from "../../src/site/activity/github.ts";
import { ROOT } from "../../src/site/repo.ts";
import { SAMPLE_ACTIVITY, sampleActivity } from "../sample/activity.ts";
import sample from "../sample/site.config.ts";

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

const FIXTURE_FROM_THE_ROOT = relative(ROOT, SAMPLE_ACTIVITY);
const withTheFixture = { [ACTIVITY_FIXTURE]: SAMPLE_ACTIVITY };
const activity = sample.activity ?? {};

test("without ACTIVITY_FIXTURE, the places are asked over the network, and nothing is said of it", () => {
  const { said, log } = logger();
  assert.equal(activityFetch({}, log), fetch);
  assert.deepEqual(said, []);
});

test("with ACTIVITY_FIXTURE, the file it names stands in for every place, and the build says so", async () => {
  const { said, log } = logger();
  const fetchFromTheFixture = activityFetch({ [ACTIVITY_FIXTURE]: FIXTURE_FROM_THE_ROOT }, log);
  const answer = await fetchFromTheFixture(eventsAddress(activity.github ?? "", 100), {});
  assert.deepEqual(await answer.json(), sampleActivity().github?.events);
  assert.deepEqual(said, [
    `warn: the panel's activity is the fixture ${FIXTURE_FROM_THE_ROOT}, not GitHub's, GitLab's or Codeberg's, since ${ACTIVITY_FIXTURE} names it`,
  ]);
});

test("the repos fetched are said, by how many, whose and where", async () => {
  const { said, log } = logger();
  const repos = await fetchRepos(activity, withTheFixture, () => activityFetch(withTheFixture, log), log);
  assert.ok(Array.isArray(repos));
  assert.equal(
    said.at(-1),
    `info: the panel lists ${repos.length} public repos pushed to lately by sam-sample on GitHub, sam-sample on GitLab and sams on Codeberg`,
  );
});

test("a site on GitHub alone says so", async () => {
  const { said, log } = logger();
  const onGitHub = { github: "sam-sample" };
  const repos = await fetchRepos(onGitHub, withTheFixture, () => activityFetch(withTheFixture, log), log);
  assert.equal(
    said.at(-1),
    `info: the panel lists ${repos.length} public repos pushed to lately by sam-sample on GitHub`,
  );
});

test(`with ${GITHUB_TOKEN} set, the build says it asked GitHub with it, and never what it is`, async () => {
  const { said, log } = logger();
  const environment = { ...withTheFixture, [GITHUB_TOKEN]: "a-secret-token" };
  await fetchRepos(activity, environment, () => activityFetch(environment, log), log);
  assert.match(said.at(-1) ?? "", new RegExp(`, asking GitHub with ${GITHUB_TOKEN}$`));
  assert.ok(!said.some((line) => line.includes("a-secret-token")));
});

test(`with ${GITHUB_TOKEN} set on a site that doesn't read GitHub, nothing is said of it`, async () => {
  const { said, log } = logger();
  const environment = { ...withTheFixture, [GITHUB_TOKEN]: "a-secret-token" };
  await fetchRepos({ codeberg: "sams" }, environment, () => activityFetch(environment, log), log);
  assert.ok(!(said.at(-1) ?? "").includes(GITHUB_TOKEN));
});

test("repos that can't be fetched are none, and why is what's said instead", async () => {
  const { said, log } = logger();
  const elsewhere = { github: "sam-sample", codeberg: "someone-else" };
  const why = await fetchRepos(elsewhere, withTheFixture, () => activityFetch(withTheFixture, log), log);
  assert.equal(
    why,
    `Codeberg has no user by that name (user redirect does not exist [name: someone-else]), at ${feedAddress("someone-else", 50)}`,
  );
  assert.ok(!said.some((line) => line.startsWith("info:")));
});

test("a fixture that isn't there is a failure like any other, not a crash", async () => {
  const { log } = logger();
  const missing = { [ACTIVITY_FIXTURE]: "no/such/file.json" };
  const why = await fetchRepos(activity, missing, () => activityFetch(missing, log), log);
  assert.match(String(why), /ENOENT/);
});
