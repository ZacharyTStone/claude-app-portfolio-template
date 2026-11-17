/* The sample's posts on Qiita, made up (qiita.json): what the tests' stand-in
   for Qiita's API answers (src/site/writing/fixture.ts). Every build the
   tests make is given the file (astro-build.ts), so no test reaches Qiita. */
import { fileURLToPath } from "node:url";
import { fixtureFetch, readFixture } from "../../src/site/writing/fixture.ts";
import type { Post } from "../../src/site/writing/post.ts";
import { qiitaPosts } from "../../src/site/writing/qiita.ts";

/** The fixture's file, as a path. */
export const SAMPLE_QIITA = fileURLToPath(new URL("qiita.json", import.meta.url));

/** The same user before their first post (qiita-no-posts.json): Qiita
    answers with an empty list. */
export const SAMPLE_QIITA_WITH_NO_POSTS = fileURLToPath(new URL("qiita-no-posts.json", import.meta.url));

export const sampleFixture = () => readFixture(SAMPLE_QIITA);

/** The sample's posts, as a build makes them of the fixture: the public
    ones, newest first. */
export const samplePosts = (): Promise<Post[]> =>
  qiitaPosts(sampleFixture().user, { fetch: fixtureFetch(sampleFixture()) });
