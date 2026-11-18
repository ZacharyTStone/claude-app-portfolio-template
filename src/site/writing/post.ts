/* A post the Writing tab lists, as the build fetched it from one of the
   places the config names (sources.ts). */

/** How many have liked a post, where its place counts them. */
type Likes = {
  count: number;
  /** The place's own word for them, the same in every language: "LGTM" on
      Qiita. Left out, the page's strings.writingLikes says it ("likes"). */
  word?: string;
};

/** As much of a post as the site shows: its body only on a site whose
    viewer shows its posts (the config's writing.viewer), and only from a
    place that gives the post as its author wrote it (Qiita). */
export type Post = {
  /** Its id, unique in the tab, which its own page on this site is named
      by: "c0ffee0000000000c0f1" (a Qiita post's own id), "zenn-…". */
  id: string;
  /** As its author wrote it, in whatever language. */
  title: string;
  /** Its page: "https://qiita.com/alex-example/items/…". */
  url: string;
  /** When it was posted, with an offset from UTC: its author's, on Qiita,
      and the config's timezone's anywhere else:
      "2026-10-01T09:30:00+09:00". */
  posted: string;
  /** Where it was posted, as a page names it: "Qiita", "Zenn", a feed's
      name. */
  place: string;
  /** How many have liked it: left out where its place doesn't say. */
  likes?: Likes;
  /** Its tags, in its author's order: ["TypeScript", "Astro"]. */
  tags: string[];
  /** Its text as its author wrote it, in Qiita's Markdown: kept only for a
      site whose viewer shows its posts, and read into pieces, never into
      HTML (body.ts). */
  body?: string;
};

/** The day it was posted, by its author's clock: "2026-10-01". */
export const dayPosted = (post: Post): string => post.posted.slice(0, "YYYY-MM-DD".length);

/** The newest first. Two posted at the same moment keep their order. */
export const newestFirst = (posts: Post[]): Post[] =>
  posts.toSorted((one, other) => Date.parse(other.posted) - Date.parse(one.posted));

/** Kana. Text with any is Japanese; text with kanji alone could be Chinese
    as well, so it isn't taken for Japanese. */
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

export const isInJapanese = (text: string): boolean => KANA.test(text);
