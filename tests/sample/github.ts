/* The sample's public activity on GitHub, made up (github.json): what the
   tests' stand-in for GitHub's API answers (src/site/activity/fixture.ts).
   Every build the tests make is given the file (astro-build.ts), so no test
   reaches GitHub. */
import { fileURLToPath } from "node:url";
import { fixtureFetch, readFixture } from "../../src/site/activity/fixture.ts";
import { recentRepos, type Repo } from "../../src/site/activity/github.ts";

/** The fixture's file, as a path. */
export const SAMPLE_GITHUB = fileURLToPath(new URL("github.json", import.meta.url));

export const sampleGitHub = () => readFixture(SAMPLE_GITHUB);

/** The sample's repos, as a build makes them of the fixture: the public
    ones pushed to, the latest first. */
export const sampleRepos = (): Promise<Repo[]> =>
  recentRepos(sampleGitHub().user, { fetch: fixtureFetch(sampleGitHub()) });
