/* A GitHub user's whole history, from GitHub's GraphQL API, in two kinds of
   query. The first asks when the account was made, which years have a
   contribution, and the languages of the user's own public repos, forks
   left out, a hundred repos a page. The second asks for those years'
   calendars, each its own contributionsCollection, as the API asks a
   year at most of each, a few years to a request. Only what the parts draw
   is kept (history.ts): each repo's languages, and the name, address,
   day made and description of one with code in it. */
import { chunk, range } from "es-toolkit";
import * as v from "valibot";
import { askGitHub, type AskOptions } from "./graphql.ts";
import { dayOf, dayOfYear, type History, type HistoryYear, type LanguageSize, type PublicRepo } from "./history.ts";

export type HistoryOptions = AskOptions & {
  /** When the build asks: the calendar of this year goes up to it. */
  now?: Date;
  /** Repos a page: 100, unless a test asks for fewer to see the pages followed. */
  perPage?: number;
};

/** The most pages of repos read, and the most of a repo's languages: a
    hundred a page, its ten largest. */
const REPO_PAGES = { size: 100, most: 10 } as const;
const LANGUAGES_A_REPO = 10;

/** The most of a repo's description kept: a sentence or two. */
const DESCRIPTION_CHARACTERS = 200;

/** How many years' calendars one request asks for. */
const YEARS_A_REQUEST = 4;

export const OVERVIEW_QUERY = `query ($login: String!, $first: Int!, $after: String) {
  user(login: $login) {
    createdAt
    contributionsCollection { contributionYears }
    repositories(ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false, first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name url createdAt description
        languages(first: ${LANGUAGES_A_REPO}, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
      }
    }
  }
}`;

const Count = v.pipe(v.number(), v.integer(), v.minValue(0));
const Year = v.pipe(v.number(), v.integer(), v.minValue(2000), v.maxValue(9999));
/** As GitHub names a language: "TypeScript", "Jupyter Notebook". */
const LanguageName = v.pipe(v.string(), v.nonEmpty(), v.maxLength(100));

const LanguagesSchema = v.object({
  edges: v.array(v.nullable(v.object({ size: Count, node: v.object({ name: LanguageName }) }))),
});

/** A repo as GitHub names it: letters, digits, ".", "-" and "_". */
const RepoName = v.pipe(v.string(), v.regex(/^[\w.-]{1,100}$/));

const RepoSchema = v.object({
  name: RepoName,
  url: v.pipe(v.string(), v.url(), v.startsWith("https://github.com/")),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  description: v.nullable(v.string()),
  languages: v.nullable(LanguagesSchema),
});

const OverviewSchema = v.object({
  user: v.object({
    createdAt: v.pipe(v.string(), v.isoTimestamp()),
    contributionsCollection: v.object({ contributionYears: v.array(Year) }),
    repositories: v.object({
      pageInfo: v.object({ hasNextPage: v.boolean(), endCursor: v.nullable(v.string()) }),
      nodes: v.array(v.nullable(RepoSchema)),
    }),
  }),
});

type Overview = v.InferOutput<typeof OverviewSchema>["user"];

const YearSchema = v.object({
  restrictedContributionsCount: Count,
  contributionCalendar: v.object({
    totalContributions: Count,
    weeks: v.array(
      v.object({
        contributionDays: v.array(v.object({ date: v.pipe(v.string(), v.isoDate()), contributionCount: Count })),
      }),
    ),
  }),
});

type YearAnswer = v.InferOutput<typeof YearSchema>;

/** "y2019": the name a year's calendar has in the query and its answer. */
export const yearAlias = (year: number): string => `y${year}`;

/** A moment as GitHub's DateTime has it, to the second: "2026-11-18T04:51:15Z". */
const toTheSecond = (moment: Date): string => moment.toISOString().replace(/\.\d+Z$/, "Z");

/** The end of a year's calendar: its last second, or now, in the year it is. */
const endOf = (year: number, now: Date): string =>
  year >= now.getUTCFullYear() ? toTheSecond(now) : `${year}-12-31T23:59:59Z`;

export function calendarsQuery(years: number[], now: Date): string {
  const calendars = years.map(
    (year) =>
      `${yearAlias(year)}: contributionsCollection(from: "${year}-01-01T00:00:00Z", to: "${endOf(year, now)}") { ...year }`,
  );
  return `query ($login: String!) {
  user(login: $login) {
    ${calendars.join("\n    ")}
  }
}
fragment year on ContributionsCollection {
  restrictedContributionsCount
  contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
}`;
}

/** Every page of the overview, its first for when the account was made
    and the years, the rest for more of the repos. */
async function overviewOf(login: string, options: HistoryOptions): Promise<Overview[]> {
  const pages: Overview[] = [];
  let after: string | null = null;
  for (let page = 1; page <= REPO_PAGES.most; page++) {
    const variables: Record<string, unknown> = { login, first: options.perPage ?? REPO_PAGES.size, after };
    const { user }: { user: Overview } = await askGitHub(
      { text: OVERVIEW_QUERY, variables, schema: OverviewSchema },
      options,
    );
    pages.push(user);
    const { hasNextPage, endCursor } = user.repositories.pageInfo;
    if (!hasNextPage || endCursor === null) break;
    after = endCursor;
  }
  return pages;
}

/** Each language's bytes across the repos, the most first. */
function languagesOf(pages: Overview[]): LanguageSize[] {
  const sizes = new Map<string, number>();
  const edges = pages.flatMap((page) => page.repositories.nodes.flatMap((repo) => repo?.languages?.edges ?? []));
  for (const edge of edges) if (edge) sizes.set(edge.node.name, (sizes.get(edge.node.name) ?? 0) + edge.size);
  return [...sizes]
    .map(([name, size]) => ({ name, size }))
    .sort((one, other) => other.size - one.size || one.name.localeCompare(other.name));
}

type Repo = v.InferOutput<typeof RepoSchema>;

const hasCode = (repo: Repo | null): repo is Repo => Boolean(repo?.languages?.edges.length);

/** A repo as it's kept: its description cut to a sentence or two, and
    none if it has none. */
function repoKept({ name, url, createdAt, description }: Repo): PublicRepo {
  const said = description?.trim().slice(0, DESCRIPTION_CHARACTERS).trim();
  return { name, url, madeOn: dayOf(createdAt), ...(said ? { description: said } : {}) };
}

/** The repos with code in them, the oldest first, but for the profile's
    README repo, which is named as its owner is. */
function reposOf(pages: Overview[], login: string): PublicRepo[] {
  const isProfile = (name: string) => name.toLowerCase() === login.toLowerCase();
  return pages
    .flatMap((page) => page.repositories.nodes)
    .filter(hasCode)
    .filter((repo) => !isProfile(repo.name))
    .map(repoKept)
    .sort((one, other) => one.madeOn.localeCompare(other.madeOn) || one.name.localeCompare(other.name));
}

/** The calendars of `years`, by year. */
async function calendarsOf(login: string, years: number[], options: HistoryOptions & { now: Date }) {
  const calendars = new Map<number, YearAnswer>();
  for (const someYears of chunk(years, YEARS_A_REQUEST)) {
    const schema = v.object({
      user: v.object(Object.fromEntries(someYears.map((year) => [yearAlias(year), YearSchema]))),
    });
    const text = calendarsQuery(someYears, options.now);
    const { user } = await askGitHub({ text, variables: { login }, schema }, options);
    for (const year of someYears) calendars.set(year, user[yearAlias(year)] as YearAnswer);
  }
  return calendars;
}

/** A year as it's kept: a count for each day from January 1 to the last day
    the calendar has, but never past `today`. */
function yearKept(year: number, answer: YearAnswer, today: string): HistoryYear {
  const days: number[] = [];
  for (const { contributionDays } of answer.contributionCalendar.weeks) {
    for (const { date, contributionCount } of contributionDays) {
      if (date.startsWith(`${year}-`) && date <= today) days[dayOfYear(date)] = contributionCount;
    }
  }
  return {
    year,
    total: answer.contributionCalendar.totalContributions,
    restricted: answer.restrictedContributionsCount,
    days: Array.from(days, (count) => count ?? 0),
  };
}

/** The last day the history has: the newest year's last, or today if it
    has no years. */
function lastDayOf(years: HistoryYear[], today: string): string {
  const newest = years.at(-1);
  if (!newest || !newest.days.length) return today;
  return dayOf(new Date(Date.UTC(newest.year, 0, newest.days.length)));
}

/** The whole history of `login`, from the first year with a contribution
    to the last. Throws, saying why, if GitHub can't be reached, refuses,
    has no such user, or sends anything but what was asked for. */
export async function githubHistory(login: string, options: HistoryOptions): Promise<History> {
  const now = options.now ?? new Date();
  const pages = await overviewOf(login, options);
  const [first] = pages;
  if (!first) throw new Error("GitHub sent no overview");
  const contributionYears = first.contributionsCollection.contributionYears.filter(
    (year) => year <= now.getUTCFullYear(),
  );
  const years = contributionYears.length
    ? range(Math.min(...contributionYears), Math.max(...contributionYears) + 1)
    : [];
  const calendars = await calendarsOf(login, years, { ...options, now });
  const today = dayOf(now);
  const kept = years.flatMap((year) => {
    const answer = calendars.get(year);
    return answer ? [yearKept(year, answer, today)] : [];
  });
  return {
    createdAt: first.createdAt,
    asOf: lastDayOf(kept, today),
    years: kept,
    languages: languagesOf(pages),
    repos: reposOf(pages, login),
  };
}
