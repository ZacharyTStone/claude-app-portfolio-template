/* Fetches the GitHub history (src/site/history) as a build or the dev
   server starts, after the config's check, and gives the pages it in place
   of src/site/history/fetched.ts. A build stops if it can't be had, and if
   a mark the config names is in no year of it: a host then keeps the site
   it has, rather than putting up one whose answers are missing their
   parts. The dev server says so and serves on, without the parts. A site
   without `githubHistory` fetches nothing, and its pages are as they were. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { GitHubHistory } from "../config/github-history.ts";
import { GITHUB_TOKEN } from "../site/activity/github.ts";
import type { Fetch } from "../site/fetching.ts";
import { fixtureFetch, GITHUB_HISTORY_FIXTURE, readFixture } from "../site/history/fixture.ts";
import type { History } from "../site/history/history.ts";
import { githubHistory } from "../site/history/queries.ts";
import { hiddenButNotFound } from "../site/history/repos.ts";
import { historyStats } from "../site/history/stats.ts";
import { marksOffTheTimeline } from "../site/history/weeks.ts";
import { writtenNumber } from "../site/history/words.ts";
import type { LoadedSiteConfig } from "../site/load-site-config.ts";
import { ROOT } from "../site/repo.ts";
import { inPlaceOfTheFile, type Log } from "./in-place.ts";

/** The module the pages read the history from. */
const FETCHED_MODULE = fileURLToPath(new URL("../site/history/fetched.ts", import.meta.url));

const GUIDE = "docs/github-history.md";

/** How the build asks GitHub: over the network, or, when the environment
    variable GITHUB_HISTORY_FIXTURE names a file, of the tests' stand-in,
    which says so (src/site/history/fixture.ts). Throws for a file that
    isn't a fixture. */
export function historyFetch(environment: NodeJS.ProcessEnv, log: Log): Fetch {
  const fixtureFile = environment[GITHUB_HISTORY_FIXTURE];
  if (!fixtureFile) return fetch;
  log.warn(`the GitHub history is the fixture ${fixtureFile}, not GitHub's, since ${GITHUB_HISTORY_FIXTURE} names it`);
  return fixtureFetch(readFixture(resolve(ROOT, fixtureFile)));
}

/** Why there's nothing to ask with. The tests' stand-in needs no token. */
const NO_TOKEN = `GitHub's GraphQL API answers no request without a token, and ${GITHUB_TOKEN} has none: give the build a fine-grained token that reads public repositories, in ${GITHUB_TOKEN} (${GUIDE}#a-token)`;

/** What's said of the history fetched: whose, since when, and how much. */
function historyFound(user: string, history: History): string {
  const { total, since } = historyStats(history);
  const years =
    since === undefined ? "no contributions yet" : `${writtenNumber("en", total)} contributions since ${since}`;
  const repos = writtenNumber("en", history.repos.length);
  return `the GitHub history has ${user}'s ${years}, as of ${history.asOf}, the languages of their public repos, and the ${repos} of those with code in them`;
}

/** What's said of a name githubHistory.repos hides that's none of the
    repos fetched: it hides nothing, which may be a typo. It isn't a
    problem: a repo renamed, made private or deleted would otherwise stop
    the next day's build. */
export function hiddenNotFoundWarning({ user, repos }: GitHubHistory, history: History): string | undefined {
  const names = hiddenButNotFound(history, repos);
  if (!names.length) return undefined;
  const quoted = names.map((name) => `"${name}"`).join(", ");
  return `githubHistory.repos hides ${quoted}, but ${user} has no public repo with code by that name, so it hides nothing: check the spelling, or take it out if the repo was renamed, made private or deleted`;
}

/** The history of the user githubHistory names, asked for as `howToAsk`
    says, with the token in `environment`'s GITHUB_TOKEN; or why there is
    none. */
export async function fetchHistory(
  config: GitHubHistory,
  environment: NodeJS.ProcessEnv,
  howToAsk: () => Fetch,
  log: Log,
): Promise<History | string> {
  const token = environment[GITHUB_TOKEN] || undefined;
  if (!token && !environment[GITHUB_HISTORY_FIXTURE]) return NO_TOKEN;
  try {
    const history = await githubHistory(config.user, { fetch: howToAsk(), token });
    log.info(historyFound(config.user, history));
    const notFound = hiddenNotFoundWarning(config, history);
    if (notFound) log.warn(notFound);
    return history;
  } catch (error) {
    return withoutTheToken(error instanceof Error ? error.message : String(error), token);
  }
}

/** `why`, with the token's value taken out wherever it is, before anything
    says it: no message of this code's has it, but a server or a library
    that quoted a request back could put it in one. */
const withoutTheToken = (why: string, token: string | undefined): string =>
  token ? why.replaceAll(token, `[the token in ${GITHUB_TOKEN}]`) : why;

/** A problem for each mark in no year of the history: it has nowhere to go
    on the calendar. */
export function marksProblems({ user, marks }: GitHubHistory, history: History): string[] {
  const first = history.years[0]?.year;
  const last = history.years.at(-1)?.year;
  const runs = first === undefined ? "has no years yet" : `runs from ${first} to ${last}`;
  return marksOffTheTimeline(history, marks).map(
    ({ label, at }) =>
      `githubHistory.marks has "${label}" at ${at}, but ${user}'s history on GitHub ${runs}: a mark goes in one of its years`,
  );
}

/** What's said when there's no history, or a mark has no place in it, by
    whether it's a build. */
const COULD_NOT = {
  build: (why: string) =>
    `The GitHub history couldn't be fetched, so the build stops, and a host keeps the site it has: ${why}. Build again once it can be, or remove githubHistory from the config to build without it (${GUIDE}).`,
  dev: (why: string) =>
    `The GitHub history couldn't be fetched, so the answers show none of it until the dev server starts again: ${why}.`,
};
const MARKS_MISPLACED = {
  build: (problems: string[]) =>
    `The GitHub history can't place its marks, so the build stops:\n- ${problems.join("\n- ")}`,
  dev: (problems: string[]) => `The calendar leaves out the marks it can't place:\n- ${problems.join("\n- ")}`,
};

/** Why the build should stop, said, or nothing. */
function problemsWith(history: History | string, config: GitHubHistory, command: "build" | "dev"): string | undefined {
  if (typeof history === "string") return COULD_NOT[command](history);
  const misplaced = marksProblems(config, history);
  return misplaced.length ? MARKS_MISPLACED[command](misplaced) : undefined;
}

/** The Astro integration that fetches the history of the config Astro was
    started with. */
export function gitHubHistory({ config }: LoadedSiteConfig): AstroIntegration {
  return {
    name: "github-history",
    hooks: {
      "astro:config:setup": async ({ command, logger, updateConfig }) => {
        // `astro check` reads no history, and a preview builds nothing.
        const buildsPages = command === "build" || command === "dev";
        if (!config.githubHistory || !buildsPages) return;
        const fetched = await fetchHistory(
          config.githubHistory,
          process.env,
          () => historyFetch(process.env, logger),
          logger,
        );
        const problem = problemsWith(fetched, config.githubHistory, command);
        if (problem) logger.error(problem);
        // Thrown, Astro would call it an unhandled error and print a stack under it.
        if (problem && command === "build") process.exit(1);
        const history = typeof fetched === "string" ? null : fetched;
        updateConfig({ vite: { plugins: [inPlaceOfTheFile("github-history", FETCHED_MODULE, history)] } });
      },
    },
  };
}
