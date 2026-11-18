/* The sample's posts, made up (writing.json, and the feeds it names in
   feeds/): what the tests' stand-in for Qiita, Zenn and note answers
   (src/site/writing/fixture.ts). Every build the tests make is given the
   file (astro-build.ts), so no test reaches any of them. */
import { fileURLToPath } from "node:url";
import type { Writing } from "../../src/config/writing.ts";
import { fixtureFetch, readFixture } from "../../src/site/writing/fixture.ts";
import type { Post } from "../../src/site/writing/post.ts";
import { postsOfEveryPlace } from "../../src/site/writing/sources.ts";
import sample from "./site.config.ts";

/** The fixture's file, as a path. */
export const SAMPLE_WRITING = fileURLToPath(new URL("writing.json", import.meta.url));

/** The same user before their first post (writing-no-posts.json): every
    place answers with no posts. */
export const SAMPLE_WRITING_WITH_NO_POSTS = fileURLToPath(new URL("writing-no-posts.json", import.meta.url));

export const sampleFixture = () => readFixture(SAMPLE_WRITING);

/** The sample's `writing`, which it has. */
export function sampleWriting(): Writing {
  if (!sample.writing) throw new Error("The sample has no writing");
  return sample.writing;
}

/** The sample's posts, as a build makes them of the fixture: the public
    ones from every place, newest first, each Qiita post with its text,
    since the sample's viewer shows its posts. */
export const samplePosts = (): Promise<Post[]> =>
  postsOfEveryPlace(sampleWriting(), {
    fetch: fixtureFetch(sampleFixture()),
    timeZone: sample.timezone,
    bodies: sample.writing?.viewer,
  });
