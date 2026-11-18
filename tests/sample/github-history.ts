/* The sample's whole history on GitHub, made up (github-history.json): what
   the tests' stand-in for GitHub's GraphQL API answers
   (src/site/history/fixture.ts). Every build the tests make is given the
   file (astro-build.ts), so no test reaches GitHub. */
import { fileURLToPath } from "node:url";
import { fixtureFetch, readFixture } from "../../src/site/history/fixture.ts";
import type { History } from "../../src/site/history/history.ts";
import { githubHistory } from "../../src/site/history/queries.ts";

/** The fixture's file, as a path. */
export const SAMPLE_GITHUB_HISTORY = fileURLToPath(new URL("github-history.json", import.meta.url));

export const sampleHistoryFixture = () => readFixture(SAMPLE_GITHUB_HISTORY);

/** The sample's history, as a build makes it of the fixture. */
export const sampleHistory = (): Promise<History> =>
  githubHistory(sampleHistoryFixture().user, { fetch: fixtureFetch(sampleHistoryFixture()) });
