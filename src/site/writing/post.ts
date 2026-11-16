/* A post the Writing tab lists, as the build fetched it (qiita.ts). */

/** As much of a post as the tab shows: nothing of its body is kept. */
export type Post = {
  /** As its author wrote it, in whatever language. */
  title: string;
  /** Its page: "https://qiita.com/alex-example/items/…". */
  url: string;
  /** When it was posted, with its author's offset from UTC:
      "2026-10-01T09:30:00+09:00". */
  posted: string;
  /** How many have liked it: on Qiita, its LGTMs. */
  likes: number;
  /** Its tags, in its author's order: ["TypeScript", "Astro"]. */
  tags: string[];
};

/** The day it was posted, by its author's clock: "2026-10-01". */
export const dayPosted = (post: Post): string => post.posted.slice(0, "YYYY-MM-DD".length);

/** The newest first. Two posted at the same moment keep their order. */
export const newestFirst = (posts: Post[]): Post[] =>
  posts.toSorted((one, other) => Date.parse(other.posted) - Date.parse(one.posted));
