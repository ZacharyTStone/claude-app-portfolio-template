/* Fetches the Writing tab's posts (src/site/writing) as a build or the dev
   server starts, after the config's check, and gives the pages their list
   in place of src/site/writing/fetched.ts. A build stops if they can't be
   had: a host then keeps the site it has, rather than putting up one with
   the tab gone. The dev server says so and serves on, with no posts. With
   none, the site has no tab, unless its config asks for one that says so.
   A site without `writing` fetches nothing, and its pages are as they were. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { Writing } from "../config/writing.ts";
import type { Fetch } from "../site/fetching.ts";
import type { LoadedSiteConfig } from "../site/load-site-config.ts";
import { ROOT } from "../site/repo.ts";
import { fixtureFetch, readFixture, WRITING_FIXTURE } from "../site/writing/fixture.ts";
import type { Post } from "../site/writing/post.ts";
import { qiitaPosts } from "../site/writing/qiita.ts";
import { inPlaceOfTheFile, type Log } from "./in-place.ts";

/** The module the pages read the posts from. */
const FETCHED_MODULE = fileURLToPath(new URL("../site/writing/fetched.ts", import.meta.url));

const GUIDE = "docs/writing.md";

/** How the build asks Qiita: over the network, or, when the environment
    variable WRITING_FIXTURE names a file, of the tests' stand-in, which
    says so (src/site/writing/fixture.ts). Throws for a file that isn't a
    fixture. */
export function qiitaFetch(environment: NodeJS.ProcessEnv, log: Log): Fetch {
  const fixtureFile = environment[WRITING_FIXTURE];
  if (!fixtureFile) return fetch;
  log.warn(`the Writing tab's posts are the fixture ${fixtureFile}, not Qiita's, since ${WRITING_FIXTURE} names it`);
  return fixtureFetch(readFixture(resolve(ROOT, fixtureFile)));
}

/** What's said of the posts fetched: how many and whose (and that each has
    a page of the site's own, where the viewer shows them), and, with none,
    what the site has for a tab. */
function postsFound(count: number, { qiita, showWhenEmpty, viewer }: Writing): string {
  const inTheViewer = viewer ? ", each with a page of its own for the viewer (writing.viewer)" : "";
  if (count > 0) return `the Writing tab lists ${count} posts by ${qiita} on Qiita${inTheViewer}`;
  return showWhenEmpty
    ? `${qiita} has no public posts on Qiita yet, and the Writing tab says so (writing.showWhenEmpty)`
    : `${qiita} has no public posts on Qiita yet, so the site has no Writing tab until the first`;
}

/** The posts of the Qiita user `writing` names, asked for as `howToAsk`
    says, or why there are none. */
export async function fetchPosts(writing: Writing, howToAsk: () => Fetch, log: Log): Promise<Post[] | string> {
  try {
    const posts = await qiitaPosts(writing.qiita, { fetch: howToAsk(), bodies: writing.viewer });
    log.info(postsFound(posts.length, writing));
    return posts;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** What's said when there are no posts to list, by whether it's a build. */
const COULD_NOT = {
  build: (why: string) =>
    `The Writing tab's posts couldn't be fetched, so the build stops, and a host keeps the site it has: ${why}. Build again once Qiita answers, or remove writing from the config to build without the tab (${GUIDE}).`,
  dev: (why: string) =>
    `The Writing tab's posts couldn't be fetched, so the site has none until the dev server starts again: ${why}.`,
};

/** The Astro integration that fetches the posts of the config Astro was
    started with. */
export function writingPosts({ config }: LoadedSiteConfig): AstroIntegration {
  return {
    name: "writing-posts",
    hooks: {
      "astro:config:setup": async ({ command, logger, updateConfig }) => {
        // `astro check` reads no posts, and a preview builds nothing.
        const buildsPages = command === "build" || command === "dev";
        if (!config.writing || !buildsPages) return;
        const posts = await fetchPosts(config.writing, () => qiitaFetch(process.env, logger), logger);
        if (typeof posts === "string") logger.error(COULD_NOT[command](posts));
        // Thrown, Astro would call it an unhandled error and print a stack under it.
        if (typeof posts === "string" && command === "build") process.exit(1);
        const listed = typeof posts === "string" ? [] : posts;
        updateConfig({ vite: { plugins: [inPlaceOfTheFile("writing-posts", FETCHED_MODULE, listed)] } });
      },
    },
  };
}
