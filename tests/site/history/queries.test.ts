/* A GitHub user's whole history as the build asks for it
   (src/site/history/queries.ts, graphql.ts), with GitHub stood in for: the
   two queries, what's kept of their answers, the pages and the years
   followed, and each way it can fail. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { GITHUB_TOKEN } from "../../../src/site/activity/github.ts";
import type { Fetch } from "../../../src/site/fetching.ts";
import { fixtureFetch } from "../../../src/site/history/fixture.ts";
import { GRAPHQL_ADDRESS } from "../../../src/site/history/graphql.ts";
import { githubHistory, OVERVIEW_QUERY, yearAlias } from "../../../src/site/history/queries.ts";
import { sampleHistory, sampleHistoryFixture } from "../../sample/github-history.ts";

const USER = "sam-sample";
const TOKEN = "a-secret-token";
/** A test has no time to wait before a request is tried again. */
const NO_WAIT = 0;
/** When a test's build asks: after the fixture's last day. */
const NOW = new Date("2026-11-18T04:51:15.123Z");

type Asked = { address: string; init: RequestInit; query: string; variables: Record<string, unknown> };

/** GitHub, stood in for: each request gets the next of `answers` (an Error
    is thrown, as fetch() throws) and is kept in `asked`. With no answers,
    the sample's fixture answers. */
function gitHubAnswering(...answers: Array<Response | Error>) {
  const asked: Asked[] = [];
  const fromTheFixture = fixtureFetch(sampleHistoryFixture());
  const fetch: Fetch = async (address, init) => {
    const { query, variables } = JSON.parse(String(init.body));
    asked.push({ address, init, query, variables });
    if (!answers.length) return fromTheFixture(address, init);
    const answer = answers[asked.length - 1] ?? answers.at(-1);
    if (answer instanceof Error) throw answer;
    if (!answer) throw new Error("the test gave GitHub nothing to say");
    return answer.clone();
  };
  return { fetch, asked };
}

const historyOf = (fetch: Fetch, more: { perPage?: number; now?: Date } = {}) =>
  githubHistory(USER, { fetch, token: TOKEN, retryAfterMs: NO_WAIT, now: NOW, ...more });

/** How a failure ends: where it was. */
const AT = `, at ${GRAPHQL_ADDRESS}`;

test("the sample's history runs a year a row from its first contribution to the last day its calendar has", async () => {
  const history = await sampleHistory();
  assert.equal(history.createdAt, "2019-09-16T08:12:40Z");
  assert.equal(history.asOf, "2026-11-15");
  assert.deepEqual(
    history.years.map(({ year, days }) => [year, days.length]),
    [
      [2019, 365],
      [2020, 366],
      [2021, 365],
      [2022, 365],
      [2023, 365],
      [2024, 366],
      [2025, 365],
      [2026, 319],
    ],
  );
});

test("the languages are the user's own public repos', the most written first: a fork's and a private repo's are left out", async () => {
  const { languages } = await sampleHistory();
  assert.deepEqual(languages.slice(0, 3), [
    { name: "TypeScript", size: 558520 },
    { name: "Go", size: 181100 },
    { name: "Python", size: 108100 },
  ]);
  assert.equal(languages.find(({ name }) => name === "JavaScript")?.size, 13200);
  assert.ok(!languages.some(({ name }) => name === "Kotlin"));
});

test("every request is a POST of a query to GitHub's GraphQL API, as JSON, with the token and a time limit", async () => {
  const { fetch, asked } = gitHubAnswering();
  await historyOf(fetch);
  for (const { address, init } of asked) {
    assert.equal(address, GRAPHQL_ADDRESS);
    assert.equal(init.method, "POST");
    const headers = new Headers(init.headers);
    assert.equal(headers.get("authorization"), `Bearer ${TOKEN}`);
    assert.equal(headers.get("content-type"), "application/json");
    assert.ok(init.signal instanceof AbortSignal);
  }
});

test("the overview asks for the user's own public repos that aren't forks, each its ten largest languages", () => {
  assert.match(OVERVIEW_QUERY, /repositories\(ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false, /);
  assert.match(OVERVIEW_QUERY, /languages\(first: 10, orderBy: \{ field: SIZE, direction: DESC \}\)/);
  assert.match(OVERVIEW_QUERY, /contributionsCollection \{ contributionYears \}/);
});

test("the repos are read a page at a time, by GitHub's cursor, to the same languages", async () => {
  const { fetch, asked } = gitHubAnswering();
  const { languages } = await historyOf(fetch, { perPage: 5 });
  const overviews = asked.filter(({ query }) => query === OVERVIEW_QUERY);
  assert.deepEqual(
    overviews.map(({ variables }) => variables.after),
    [null, "5", "10"],
  );
  assert.deepEqual(languages, (await sampleHistory()).languages);
});

test("each year's calendar is a contributionsCollection of its own, to its last second, or to now in this year, four years a request", async () => {
  const { fetch, asked } = gitHubAnswering();
  await historyOf(fetch);
  const calendars = asked.filter(({ query }) => query !== OVERVIEW_QUERY).map(({ query }) => query);
  assert.equal(calendars.length, 2);
  assert.match(
    calendars[0] ?? "",
    /y2019: contributionsCollection\(from: "2019-01-01T00:00:00Z", to: "2019-12-31T23:59:59Z"\)/,
  );
  assert.match(
    calendars[1] ?? "",
    /y2026: contributionsCollection\(from: "2026-01-01T00:00:00Z", to: "2026-11-18T04:51:15Z"\)/,
  );
  assert.equal(yearAlias(2026), "y2026");
});

test("no day after the day the build asks is kept, whatever the calendar has", async () => {
  const { fetch } = gitHubAnswering();
  const history = await historyOf(fetch, { now: new Date("2026-03-01T10:00:00Z") });
  assert.equal(history.asOf, "2026-03-01");
  assert.equal(history.years.at(-1)?.days.length, 60);
});

/** An overview for a user with no contributions, and no public repos. */
const NOTHING_YET = Response.json({
  data: {
    user: {
      createdAt: "2026-11-01T00:00:00Z",
      contributionsCollection: { contributionYears: [] },
      repositories: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
    },
  },
});

test("a user with no contributions yet has no years and no languages, as of the day the build asks", async () => {
  const { fetch, asked } = gitHubAnswering(NOTHING_YET);
  assert.deepEqual(await historyOf(fetch), {
    createdAt: "2026-11-01T00:00:00Z",
    asOf: "2026-11-18",
    years: [],
    languages: [],
  });
  assert.equal(asked.length, 1);
});

test("a name GitHub has no user by stops the build, saying so, without asking again", async () => {
  const { fetch, asked } = gitHubAnswering(
    Response.json({
      data: { user: null },
      errors: [{ type: "NOT_FOUND", message: "Could not resolve to a User with the login of 'sam-sample'." }],
    }),
  );
  await assert.rejects(historyOf(fetch), {
    message: `GitHub has no user by that name (Could not resolve to a User with the login of 'sam-sample'.)${AT}`,
  });
  assert.equal(asked.length, 1);
});

test(`a token GitHub refuses stops the build, naming ${GITHUB_TOKEN} and never the token`, async () => {
  const { fetch, asked } = gitHubAnswering(Response.json({ message: "Bad credentials" }, { status: 401 }));
  const failure = await historyOf(fetch).catch((error: Error) => error);
  assert.equal(
    (failure as Error).message,
    `GitHub refused the token in ${GITHUB_TOKEN} (Bad credentials): give the build one it takes${AT}`,
  );
  assert.ok(!(failure as Error).message.includes(TOKEN));
  assert.equal(asked.length, 1);
});

/** GitHub's answer once the token's hourly limit is used up: 14:05 UTC is when it resets. */
const LIMIT_HEADERS = {
  "x-ratelimit-remaining": "0",
  "x-ratelimit-reset": String(Date.UTC(2026, 10, 17, 14, 5) / 1000),
};
const USED_UP = `GitHub's limit for the token in ${GITHUB_TOKEN} is used up until 14:05 UTC: build again then${AT}`;

test("a token whose hourly limit is used up stops the build, saying until when", async () => {
  const { fetch } = gitHubAnswering(
    Response.json({ message: "API rate limit exceeded" }, { status: 403, headers: LIMIT_HEADERS }),
  );
  await assert.rejects(historyOf(fetch), { message: USED_UP });
});

test("so does a query GitHub answers with its limit used up", async () => {
  const { fetch } = gitHubAnswering(
    Response.json(
      { errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded for user ID 1." }] },
      { headers: LIMIT_HEADERS },
    ),
  );
  await assert.rejects(historyOf(fetch), { message: USED_UP });
});

test("a server error is tried once more, and the build goes on if it then answers", async () => {
  const { fetch, asked } = gitHubAnswering(new Response("", { status: 502 }));
  await assert.rejects(historyOf(fetch), { message: `GitHub answered 502${AT}` });
  assert.equal(asked.length, 2);
  const once = gitHubAnswering(new Response("", { status: 502 }), NOTHING_YET);
  assert.equal((await historyOf(once.fetch)).years.length, 0);
});

test("a query GitHub couldn't answer, as when it takes too long, is tried once more", async () => {
  const { fetch, asked } = gitHubAnswering(
    Response.json({ errors: [{ message: "Something went wrong while executing your query." }] }),
  );
  await assert.rejects(historyOf(fetch), {
    message: `GitHub couldn't answer the query (Something went wrong while executing your query.)${AT}`,
  });
  assert.equal(asked.length, 2);
});

test("no connection is tried once more, and then said", async () => {
  const noConnection = new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND api.github.com") });
  const { fetch, asked } = gitHubAnswering(noConnection);
  await assert.rejects(historyOf(fetch), {
    message: `GitHub couldn't be reached: fetch failed (getaddrinfo ENOTFOUND api.github.com)${AT}`,
  });
  assert.equal(asked.length, 2);
});

test("an answer that isn't what was asked for stops the build, saying where it's wrong", async () => {
  const { fetch } = gitHubAnswering(Response.json({ data: { user: { createdAt: "yesterday" } } }));
  await assert.rejects(historyOf(fetch), {
    message: new RegExp(`^GitHub's answer isn't what its GraphQL API sends for the query \\(user\\.createdAt: `),
  });
});
