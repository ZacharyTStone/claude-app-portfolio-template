/* Fetches the panel's activity (src/site/activity) as a build or the dev
   server starts, after the config's check, and gives the pages its repos in
   place of src/site/activity/fetched.ts. A build stops if they can't be
   had: a host then keeps the site it has, rather than putting up one whose
   activity is missing. The dev server says so and serves on, with no
   section. A site without `activity` fetches nothing, and its pages are as
   they were. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { ACTIVITY_SERVICES, type Activity } from "../config/activity.ts";
import { ACTIVITY_FIXTURE, fixtureFetch, readFixture } from "../site/activity/fixture.ts";
import { GITHUB_TOKEN } from "../site/activity/github.ts";
import { recentRepos } from "../site/activity/recent.ts";
import { inWords, sourcesOf, type Repo } from "../site/activity/repo.ts";
import type { Fetch } from "../site/fetching.ts";
import type { LoadedSiteConfig } from "../site/load-site-config.ts";
import { ROOT } from "../site/repo.ts";
import { inPlaceOfTheFile, type Log } from "./in-place.ts";

/** The module the pages read the repos from. */
const FETCHED_MODULE = fileURLToPath(new URL("../site/activity/fetched.ts", import.meta.url));

const GUIDE = "docs/activity.md";

/** How the build asks GitHub, GitLab and Codeberg: over the network, or,
    when the environment variable ACTIVITY_FIXTURE names a file, of the
    tests' stand-in, which says so (src/site/activity/fixture.ts). Throws
    for a file that isn't a fixture. */
export function activityFetch(environment: NodeJS.ProcessEnv, log: Log): Fetch {
  const fixtureFile = environment[ACTIVITY_FIXTURE];
  if (!fixtureFile) return fetch;
  const theirs = inWords(
    Object.values(ACTIVITY_SERVICES).map((name) => `${name}'s`),
    "or",
  );
  log.warn(`the panel's activity is the fixture ${fixtureFile}, not ${theirs}, since ${ACTIVITY_FIXTURE} names it`);
  return fixtureFetch(readFixture(resolve(ROOT, fixtureFile)));
}

/** "sam on GitHub", "sam on GitHub and sam-s on Codeberg": whose repos
    were asked for, and where. */
const whoseAndWhere = (activity: Activity): string =>
  inWords(sourcesOf(activity).map(({ service, user }) => `${user} on ${ACTIVITY_SERVICES[service]}`));

/** The public repos `activity`'s user pushed to most recently, asked for
    as `howToAsk` says, with the token in `environment`'s GITHUB_TOKEN for
    GitHub if it has one; or why there are none. */
export async function fetchRepos(
  activity: Activity,
  environment: NodeJS.ProcessEnv,
  howToAsk: () => Fetch,
  log: Log,
): Promise<Repo[] | string> {
  const githubToken = environment[GITHUB_TOKEN] || undefined;
  try {
    const repos = await recentRepos(activity, { fetch: howToAsk(), githubToken });
    const how = githubToken && activity.github ? `, asking GitHub with ${GITHUB_TOKEN}` : "";
    log.info(`the panel lists ${repos.length} public repos pushed to lately by ${whoseAndWhere(activity)}${how}`);
    return repos;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** What's said when there are no repos to list, by whether it's a build. */
const COULD_NOT = {
  build: (why: string) =>
    `The panel's activity couldn't be fetched, so the build stops, and a host keeps the site it has: ${why}. Build again later, or remove activity from the config to build without it (${GUIDE}).`,
  dev: (why: string) =>
    `The panel's activity couldn't be fetched, so it shows none until the dev server starts again: ${why}.`,
};

/** The Astro integration that fetches the activity of the config Astro was
    started with. */
export function recentActivity({ config }: LoadedSiteConfig): AstroIntegration {
  return {
    name: "activity",
    hooks: {
      "astro:config:setup": async ({ command, logger, updateConfig }) => {
        // `astro check` reads no repos, and a preview builds nothing.
        const buildsPages = command === "build" || command === "dev";
        if (!config.activity || !buildsPages) return;
        const asking = () => activityFetch(process.env, logger);
        const repos = await fetchRepos(config.activity, process.env, asking, logger);
        if (typeof repos === "string") logger.error(COULD_NOT[command](repos));
        // Thrown, Astro would call it an unhandled error and print a stack under it.
        if (typeof repos === "string" && command === "build") process.exit(1);
        const listed = typeof repos === "string" ? [] : repos;
        updateConfig({ vite: { plugins: [inPlaceOfTheFile("activity", FETCHED_MODULE, listed)] } });
      },
    },
  };
}
