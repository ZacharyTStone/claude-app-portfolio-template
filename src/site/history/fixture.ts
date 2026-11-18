/* A stand-in for GitHub's GraphQL API, so that no test reaches
   api.github.com: it answers the two queries the build asks (queries.ts)
   from a file of a made-up user's history. A build uses it only when the
   environment variable GITHUB_HISTORY_FIXTURE names that file, which only
   the tests set, and then only for the user the file is for. Any other
   user gets the error GitHub gives a name it doesn't have, and the build
   stops: the file's made-up history can't stand in for a real site's.

   The file is kept small: each year's days are a line of characters, one
   a day from January 1, "0" to "9" and then "a" to "z" for 10 to 35. The
   stand-in writes GitHub's answer from them, as GitHub would: the days of
   the range asked, a week from each Sunday. */
import { readFileSync } from "node:fs";
import * as v from "valibot";
import type { Fetch } from "../fetching.ts";
import { GRAPHQL_ADDRESS } from "./graphql.ts";
import { dayIn, dayOf, weekdayOf } from "./history.ts";

/** The environment variable that names the fixture's file, from the repo's
    root: "tests/sample/github-history.json". */
export const GITHUB_HISTORY_FIXTURE = "GITHUB_HISTORY_FIXTURE";

/** "0"–"9", then "a"–"z": a day's count as one character. */
const DAY_CHARACTERS = /^[0-9a-z]*$/;
const COUNT_BASE = 36;

const FixtureSchema = v.object({
  /** The GitHub user name the history is for. */
  user: v.string(),
  /** When the account was made: "2019-09-16T08:12:40Z". */
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  /** Each year's days, by the year: a character a day from January 1. */
  days: v.record(v.pipe(v.string(), v.regex(/^\d{4}$/)), v.pipe(v.string(), v.regex(DAY_CHARACTERS))),
  /** Each year's private contributions, counted among its days but not shown. */
  restricted: v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(0))),
  /** Every repo the user has: its name, when it was made, what it says it
      is, and its languages' bytes by name (none for one with no code). One
      that's a fork or private is marked so, and GitHub leaves it out of a
      query that asks for neither. */
  repos: v.array(
    v.object({
      name: v.string(),
      createdAt: v.pipe(v.string(), v.isoTimestamp()),
      description: v.optional(v.string()),
      languages: v.record(v.string(), v.number()),
      fork: v.optional(v.boolean()),
      private: v.optional(v.boolean()),
    }),
  ),
});

export type Fixture = v.InferOutput<typeof FixtureSchema>;

/** Throws if the file isn't there, or isn't a fixture. */
export const readFixture = (file: string): Fixture => v.parse(FixtureSchema, JSON.parse(readFileSync(file, "utf8")));

/** Each day of a year as the file has it, by its date. */
const daysOf = (fixture: Fixture, year: number): Array<{ date: string; contributionCount: number }> =>
  Array.from(fixture.days[String(year)] ?? "", (character, index) => ({
    date: dayIn(year, index),
    contributionCount: parseInt(character, COUNT_BASE),
  }));

const AskedSchema = v.object({ query: v.string(), variables: v.record(v.string(), v.unknown()) });

type Asked = v.InferOutput<typeof AskedSchema>;

/** The overview's answer: a page of the repos the query asks for. A cursor
    is the place in the list where the page after it starts. */
function overview(fixture: Fixture, { query, variables }: Asked) {
  const repos = fixture.repos.filter(
    (repo) => !(repo.fork && query.includes("isFork: false")) && !(repo.private && query.includes("privacy: PUBLIC")),
  );
  const start = typeof variables.after === "string" ? Number(variables.after) : 0;
  const end = start + Number(variables.first);
  const nodes = repos.slice(start, end).map((repo) => ({
    name: repo.name,
    url: `https://github.com/${fixture.user}/${repo.name}`,
    createdAt: repo.createdAt,
    description: repo.description ?? null,
    languages: { edges: Object.entries(repo.languages).map(([name, size]) => ({ size, node: { name } })) },
  }));
  const contributionYears = Object.keys(fixture.days)
    .map(Number)
    .sort((one, other) => other - one);
  return {
    createdAt: fixture.createdAt,
    contributionsCollection: { contributionYears },
    repositories: { pageInfo: { hasNextPage: end < repos.length, endCursor: String(end) }, nodes },
  };
}

/** One year's calendar, between the two moments the query asks for it. */
function calendar(fixture: Fixture, year: number, from: string, to: string) {
  const days = daysOf(fixture, year).filter(({ date }) => date >= dayOf(from) && date <= dayOf(to));
  const weeks: Array<{ contributionDays: typeof days }> = [];
  for (const day of days) {
    if (weekdayOf(day.date) === 0 || !weeks.length) weeks.push({ contributionDays: [] });
    weeks.at(-1)?.contributionDays.push(day);
  }
  return {
    restrictedContributionsCount: fixture.restricted[String(year)] ?? 0,
    contributionCalendar: { totalContributions: days.reduce((sum, day) => sum + day.contributionCount, 0), weeks },
  };
}

// y2019: contributionsCollection(from: "2019-01-01T00:00:00Z", to: "2019-12-31T23:59:59Z")
const A_YEAR_ASKED = /(y(\d{4})): contributionsCollection\(from: "([^"]+)", to: "([^"]+)"\)/g;

const calendars = (fixture: Fixture, query: string) =>
  Object.fromEntries(
    Array.from(query.matchAll(A_YEAR_ASKED), ([, alias = "", year = "", from = "", to = ""]) => [
      alias,
      calendar(fixture, Number(year), from, to),
    ]),
  );

const notFound = (login: unknown) => ({
  data: { user: null },
  errors: [
    { type: "NOT_FOUND", path: ["user"], message: `Could not resolve to a User with the login of '${String(login)}'.` },
  ],
});

/** Answers as GitHub's GraphQL API would, from `fixture`: the two queries
    for its user, the error GitHub gives for any other, and a 404 at any
    other address. */
export function fixtureFetch(fixture: Fixture): Fetch {
  return async (address, init) => {
    if (address !== GRAPHQL_ADDRESS || init.method !== "POST") {
      return Response.json({ message: "Not Found" }, { status: 404 });
    }
    const asked = v.parse(AskedSchema, JSON.parse(String(init.body)));
    if (asked.variables.login !== fixture.user) return Response.json(notFound(asked.variables.login));
    const user = asked.query.includes("repositories(") ? overview(fixture, asked) : calendars(fixture, asked.query);
    return Response.json({ data: { user } });
  };
}
