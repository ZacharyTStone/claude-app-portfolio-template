/* The sample's public activity on GitHub, GitLab and Codeberg, made up
   (activity.json): what the tests' stand-in for their APIs answers
   (src/site/activity/fixture.ts). Every build the tests make is given the
   file (astro-build.ts), so no test reaches any of them. */
import { fileURLToPath } from "node:url";
import { fixtureFetch, readFixture } from "../../src/site/activity/fixture.ts";
import { recentRepos } from "../../src/site/activity/recent.ts";
import type { Repo } from "../../src/site/activity/repo.ts";
import sample from "./site.config.ts";

/** The fixture's file, as a path. */
export const SAMPLE_ACTIVITY = fileURLToPath(new URL("activity.json", import.meta.url));

export const sampleActivity = () => readFixture(SAMPLE_ACTIVITY);

/** The sample's repos, as a build makes them of the fixture: the public
    ones pushed to, wherever, the latest first. */
export const sampleRepos = (): Promise<Repo[]> =>
  recentRepos(sample.activity ?? {}, { fetch: fixtureFetch(sampleActivity()) });
