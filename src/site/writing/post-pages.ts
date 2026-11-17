/* A post's own page on the site, on a site whose viewer shows its posts
   (the config's writing.viewer): the post's text as the build fetched it,
   read into parts (body.ts), at an address under the Writing tab's. The
   viewer frames it when a visitor opens the post's card, and the page
   links to the post where it was posted. It's one page for every language:
   it has the post's words, and none of the site's own. */
import { WRITING_TAB } from "../../config/writing.ts";
import { tabPath } from "../pages.ts";
import type { Site } from "../site.ts";
import { postBlocks, type PostBlock } from "./body.ts";
import { isInJapanese, type Post } from "./post.ts";

export type PostPage = {
  post: Post;
  /** Where it is, from the site's own root: "/writing/c0ffee0000000000c0f1/". */
  path: string;
  /** The language its text is marked as: Japanese where that can be told
      (isInJapanese), or else the site's main language. */
  lang: string;
  /** The post's text, as the parts of the page. */
  blocks: PostBlock[];
};

const JAPANESE = "ja";

/** A post's page: under the Writing tab's own, in the main language, by the
    post's id. */
const postPath = (site: Site, post: Post): string => `${tabPath(site, site.main, WRITING_TAB)}${post.id}/`;

/** A page for each post whose text the build kept, in the tab's order: none
    on a site whose viewer doesn't show its posts. */
export function postPages(site: Site): PostPage[] {
  if (!site.config.writing?.viewer) return [];
  return site.posts.flatMap((post) => {
    if (post.body === undefined) return [];
    const lang = isInJapanese(`${post.title} ${post.body}`) ? JAPANESE : site.main;
    return [{ post, path: postPath(site, post), lang, blocks: postBlocks(post.body) }];
  });
}
