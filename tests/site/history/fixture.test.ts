/* The tests' stand-in for GitHub's GraphQL API (src/site/history/fixture.ts):
   it answers the build's two queries for its own user, as GitHub would. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fixtureFetch, type Fixture } from "../../../src/site/history/fixture.ts";
import { GRAPHQL_ADDRESS } from "../../../src/site/history/graphql.ts";
import { calendarsQuery, OVERVIEW_QUERY } from "../../../src/site/history/queries.ts";
import { sampleHistoryFixture } from "../../sample/github-history.ts";

const fixture: Fixture = {
  user: "sam-sample",
  createdAt: "2022-12-30T00:00:00Z",
  // December 30 and 31, 2022, a Friday and a Saturday; then January 1 to 3, 2023, from a Sunday.
  days: { 2022: `${"0".repeat(363)}2a`, 2023: "13z" },
  restricted: { 2023: 4 },
  repos: [
    { languages: { TypeScript: 100 } },
    { languages: { Kotlin: 50 }, private: true },
    { languages: { JavaScript: 900 }, fork: true },
  ],
};

const ask = (query: string, variables: Record<string, unknown>, address = GRAPHQL_ADDRESS) =>
  fixtureFetch(fixture)(address, { method: "POST", body: JSON.stringify({ query, variables }) }).then((answer) =>
    answer.json(),
  );

test("the overview has the account's age and its years, and only the repos GitHub's filters let through", async () => {
  const { data } = await ask(OVERVIEW_QUERY, { login: "sam-sample", first: 100, after: null });
  assert.equal(data.user.createdAt, fixture.createdAt);
  assert.deepEqual(data.user.contributionsCollection.contributionYears, [2023, 2022]);
  assert.deepEqual(data.user.repositories.nodes, [
    { languages: { edges: [{ size: 100, node: { name: "TypeScript" } }] } },
  ]);
});

test("a calendar is the days of the range asked, a week from each Sunday, with its year's private count", async () => {
  const query = calendarsQuery([2023], new Date("2023-01-02T12:00:00Z"));
  const { data } = await ask(query, { login: "sam-sample" });
  assert.deepEqual(data.user.y2023, {
    restrictedContributionsCount: 4,
    contributionCalendar: {
      totalContributions: 4,
      weeks: [
        {
          contributionDays: [
            { date: "2023-01-01", contributionCount: 1 },
            { date: "2023-01-02", contributionCount: 3 },
          ],
        },
      ],
    },
  });
});

test("a day's character counts up to 35", async () => {
  const { data } = await ask(calendarsQuery([2022], new Date("2024-01-01T00:00:00Z")), { login: "sam-sample" });
  const days = data.user.y2022.contributionCalendar.weeks.flatMap(
    (week: { contributionDays: unknown[] }) => week.contributionDays,
  );
  assert.deepEqual(days.slice(-2), [
    { date: "2022-12-30", contributionCount: 2 },
    { date: "2022-12-31", contributionCount: 10 },
  ]);
});

test("any other user gets the error GitHub gives a name it doesn't have", async () => {
  assert.deepEqual(await ask(OVERVIEW_QUERY, { login: "someone-else", first: 100, after: null }), {
    data: { user: null },
    errors: [
      { type: "NOT_FOUND", path: ["user"], message: "Could not resolve to a User with the login of 'someone-else'." },
    ],
  });
});

test("any other address is a 404", async () => {
  const answer = await fixtureFetch(fixture)("https://api.github.com/users/sam-sample", { method: "GET" });
  assert.equal(answer.status, 404);
});

test("the sample's fixture is for the sample's user, from a quiet start to the day it was made", () => {
  const { user, days } = sampleHistoryFixture();
  assert.equal(user, "sam-sample");
  assert.deepEqual(Object.keys(days), ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
});
