/* Fetching the GitHub history as a build starts (src/integrations/history.ts):
   how GitHub is asked, what's said, what becomes of a failure, and of a mark
   with no place on the calendar. A build of each kind is in tests/build. */
import assert from "node:assert/strict";
import { relative } from "node:path";
import { test } from "node:test";
import { fetchHistory, hiddenNotFoundWarning, historyFetch, marksProblems } from "../../src/integrations/history.ts";
import { GITHUB_TOKEN } from "../../src/site/activity/github.ts";
import { GITHUB_HISTORY_FIXTURE } from "../../src/site/history/fixture.ts";
import { GRAPHQL_ADDRESS } from "../../src/site/history/graphql.ts";
import { ROOT } from "../../src/site/repo.ts";
import { SAMPLE_GITHUB_HISTORY, sampleHistory } from "../sample/github-history.ts";

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

const FIXTURE_FROM_THE_ROOT = relative(ROOT, SAMPLE_GITHUB_HISTORY);
const withTheFixture = { [GITHUB_HISTORY_FIXTURE]: SAMPLE_GITHUB_HISTORY };
const SAMPLE = { user: "sam-sample" };

test(`without ${GITHUB_HISTORY_FIXTURE}, GitHub is asked over the network, and nothing is said of it`, () => {
  const { said, log } = logger();
  assert.equal(historyFetch({}, log), fetch);
  assert.deepEqual(said, []);
});

test(`with ${GITHUB_HISTORY_FIXTURE}, the file it names stands in for GitHub, and the build says so`, () => {
  const { said, log } = logger();
  assert.notEqual(historyFetch({ [GITHUB_HISTORY_FIXTURE]: FIXTURE_FROM_THE_ROOT }, log), fetch);
  assert.deepEqual(said, [
    `warn: the GitHub history is the fixture ${FIXTURE_FROM_THE_ROOT}, not GitHub's, since ${GITHUB_HISTORY_FIXTURE} names it`,
  ]);
});

test(`without a token in ${GITHUB_TOKEN}, nothing is asked, and why is what's said: GitHub's GraphQL API needs one`, async () => {
  const { log } = logger();
  let asked = false;
  const why = await fetchHistory(SAMPLE, {}, () => ((asked = true), fetch), log);
  assert.equal(
    why,
    `GitHub's GraphQL API answers no request without a token, and ${GITHUB_TOKEN} has none: give the build a fine-grained token that reads public repositories, in ${GITHUB_TOKEN} (docs/github-history.md#a-token)`,
  );
  assert.equal(asked, false);
});

test("the history fetched is said, by whose, since when and how much, and never with the token", async () => {
  const { said, log } = logger();
  const environment = { ...withTheFixture, [GITHUB_TOKEN]: "a-secret-token" };
  const history = await fetchHistory(SAMPLE, environment, () => historyFetch(environment, log), log);
  assert.ok(typeof history === "object");
  assert.equal(
    said.at(-1),
    "info: the GitHub history has sam-sample's 5,002 contributions since 2019, as of 2026-11-15, the languages of their public repos, and the 13 of those with code in them",
  );
  assert.ok(!said.some((line) => line.includes("a-secret-token")));
});

test("a server that quotes the token back in its refusal never gets it said: its value is taken out of why", async () => {
  const { log } = logger();
  const token = "github_pat_a-secret-token";
  const echoing = async () =>
    Response.json(
      { message: `Bad credentials: Bearer ${token}` },
      { status: 401, headers: { "content-type": "application/json" } },
    );
  const why = await fetchHistory(SAMPLE, { [GITHUB_TOKEN]: token }, () => echoing, log);
  assert.equal(typeof why, "string");
  assert.ok(!String(why).includes(token), String(why));
  assert.match(String(why), new RegExp(`\\[the token in ${GITHUB_TOKEN}\\]`));
});

test("a history that can't be fetched is none, and why is what's said instead", async () => {
  const { said, log } = logger();
  const why = await fetchHistory(
    { user: "someone-else" },
    withTheFixture,
    () => historyFetch(withTheFixture, log),
    log,
  );
  assert.equal(
    why,
    `GitHub has no user by that name (Could not resolve to a User with the login of 'someone-else'.), at ${GRAPHQL_ADDRESS}`,
  );
  assert.ok(!said.some((line) => line.startsWith("info:")));
});

test("a fixture that isn't there is a failure like any other, not a crash", async () => {
  const { log } = logger();
  const missing = { [GITHUB_HISTORY_FIXTURE]: "no/such/file.json" };
  const why = await fetchHistory(SAMPLE, missing, () => historyFetch(missing, log), log);
  assert.match(String(why), /ENOENT/);
});

test("a mark in no year of the history is a problem that names it and the years there are", async () => {
  const history = await sampleHistory();
  const marks = [
    { at: "2012-04", label: "Rapptr Labs" },
    { at: "2025-01", label: "Sellfire" },
  ];
  assert.deepEqual(marksProblems({ user: "sam-sample", marks }, history), [
    `githubHistory.marks has "Rapptr Labs" at 2012-04, but sam-sample's history on GitHub runs from 2019 to 2026: a mark goes in one of its years`,
  ]);
  assert.deepEqual(marksProblems(SAMPLE, history), []);
});

test("a repo githubHistory.repos hides that isn't among those fetched is warned of, by name, but stops nothing", async () => {
  const { said, log } = logger();
  const config = { ...SAMPLE, repos: { hide: ["DotFiles", "dotfile"] } };
  const environment = { ...withTheFixture, [GITHUB_TOKEN]: "a-secret-token" };
  const history = await fetchHistory(config, environment, () => historyFetch(environment, log), log);
  assert.ok(typeof history === "object");
  assert.equal(
    said.at(-1),
    `warn: githubHistory.repos hides "dotfile", but sam-sample has no public repo with code by that name, so it hides nothing: check the spelling, or take it out if the repo was renamed, made private or deleted`,
  );
  assert.equal(hiddenNotFoundWarning({ ...SAMPLE, repos: true }, history), undefined);
  assert.equal(hiddenNotFoundWarning(SAMPLE, history), undefined);
});
