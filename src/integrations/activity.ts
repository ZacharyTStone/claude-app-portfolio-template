/* Fetches the panel's GitHub activity (src/site/activity) as a build or the
   dev server starts, after the config's check, and gives the pages its
   repos in place of src/site/activity/fetched.ts. A build stops if they
   can't be had: a host then keeps the site it has, rather than putting up
   one whose activity is missing. The dev server says so and serves on,
   with no section. A site without `activity` fetches nothing, and its
   pages are as they were. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { ACTIVITY_FIXTURE, fixtureFetch, readFixture } from "../site/activity/fixture.ts";
import { GITHUB_TOKEN, recentRepos, type Repo } from "../site/activity/github.ts";
import type { Fetch } from "../site/fetching.ts";
import type { LoadedSiteConfig } from "../site/load-site-config.ts";
import { ROOT } from "../site/repo.ts";
import { inPlaceOfTheFile, type Log } from "./in-place.ts";

/** The module the pages read the repos from. */
const FETCHED_MODULE = fileURLToPath(new URL("../site/activity/fetched.ts", import.meta.url));

const GUIDE = "docs/github-activity.md";

/** How the build asks GitHub: over the network, or, when the environment
    variable ACTIVITY_FIXTURE names a file, of the tests' stand-in, which
    says so (src/site/activity/fixture.ts). Throws for a file that isn't a
    fixture. */
export function githubFetch(environment: NodeJS.ProcessEnv, log: Log): Fetch {
  const fixtureFile = environment[ACTIVITY_FIXTURE];
  if (!fixtureFile) return fetch;
  log.warn(
    `the panel's GitHub activity is the fixture ${fixtureFile}, not GitHub's, since ${ACTIVITY_FIXTURE} names it`,
  );
  return fixtureFetch(readFixture(resolve(ROOT, fixtureFile)));
}

/** The public repos `user` pushed to most recently, asked for as
    `howToAsk` says, with the token in `environment`'s GITHUB_TOKEN if it
    has one; or why there are none. */
export async function fetchRepos(
  user: string,
  environment: NodeJS.ProcessEnv,
  howToAsk: () => Fetch,
  log: Log,
): Promise<Repo[] | string> {
  const token = environment[GITHUB_TOKEN] || undefined;
  try {
    const repos = await recentRepos(user, { fetch: howToAsk(), token });
    const how = token ? `, asked with ${GITHUB_TOKEN}` : "";
    log.info(`the panel lists ${repos.length} public repos ${user} pushed to lately on GitHub${how}`);
    return repos;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** What's said when there are no repos to list, by whether it's a build. */
const COULD_NOT = {
  build: (why: string) =>
    `The panel's GitHub activity couldn't be fetched, so the build stops, and a host keeps the site it has: ${why}. Build again once GitHub answers, or remove activity from the config to build without it (${GUIDE}).`,
  dev: (why: string) =>
    `The panel's GitHub activity couldn't be fetched, so it shows none until the dev server starts again: ${why}.`,
};

/** The Astro integration that fetches the activity of the config Astro was
    started with. */
export function githubActivity({ config }: LoadedSiteConfig): AstroIntegration {
  return {
    name: "github-activity",
    hooks: {
      "astro:config:setup": async ({ command, logger, updateConfig }) => {
        // `astro check` reads no repos, and a preview builds nothing.
        const buildsPages = command === "build" || command === "dev";
        if (!config.activity || !buildsPages) return;
        const user = config.activity.github;
        const repos = await fetchRepos(user, process.env, () => githubFetch(process.env, logger), logger);
        if (typeof repos === "string") logger.error(COULD_NOT[command](repos));
        // Thrown, Astro would call it an unhandled error and print a stack under it.
        if (typeof repos === "string" && command === "build") process.exit(1);
        const listed = typeof repos === "string" ? [] : repos;
        updateConfig({ vite: { plugins: [inPlaceOfTheFile("github-activity", FETCHED_MODULE, listed)] } });
      },
    },
  };
}
