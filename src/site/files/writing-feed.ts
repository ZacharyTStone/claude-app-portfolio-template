/* The Writing tab's posts as an Atom feed, at feed.xml beside the tab's own
   page ("/writing/feed.xml"), on a site that has the tab: a reader can follow
   what the owner posts anywhere the tab lists, in one feed. Each entry is a
   post's title, where it links to (the post where it was posted, as its card
   does), when it was posted and its tags. Nothing of a post's text is in it.
   Every page's head points at it (src/components/PageMeta.astro). */
import { WRITING_TAB } from "../../config/writing.ts";
import { tabPath } from "../pages.ts";
import type { Site } from "../site.ts";
import { isInJapanese, type Post } from "../writing/post.ts";
import { xmlSafe } from "./sitemap-xml.ts";

/** Its name beside the tab's page: the route that writes it is named for it
    (src/pages/writing/[feed].xml.ts). */
export const WRITING_FEED_FILE = "feed.xml";

/** Its type, as a page's head names it. */
export const WRITING_FEED_TYPE = "application/atom+xml";

/** Whether the site has the Writing tab, and so the feed: with `writing`,
    once there's a post, or before then with writing.showWhenEmpty. */
export const hasWritingFeed = (site: Site): boolean =>
  site.language(site.main).threads.some((thread) => thread.id === WRITING_TAB);

/** Where it is, from the site's own root: "/writing/feed.xml". */
export const writingFeedPath = (site: Site): string => `${tabPath(site, site.main, WRITING_TAB)}${WRITING_FEED_FILE}`;

/** What it's called, as a reader lists it and a page's head names it:
    "Alex Example: Writing", in the main language's words. */
export const writingFeedTitle = (site: Site): string =>
  `${site.config.name}: ${site.language(site.main).strings.writingTitle ?? ""}`;

/** A title in Japanese on a site whose main language isn't, marked as such. */
const titleOf = (post: Post, main: string): string => {
  const japanese = isInJapanese(post.title) && main.split("-")[0] !== "ja";
  return `<title${japanese ? ' xml:lang="ja"' : ""}>${xmlSafe(post.title)}</title>`;
};

const entryOf = (post: Post, main: string): string =>
  [
    "  <entry>",
    `    ${titleOf(post, main)}`,
    `    <link rel="alternate" type="text/html" href="${xmlSafe(post.url)}"/>`,
    `    <id>${xmlSafe(post.url)}</id>`,
    `    <published>${post.posted}</published>`,
    `    <updated>${post.posted}</updated>`,
    ...post.tags.map((tag) => `    <category term="${xmlSafe(tag)}"/>`),
    "  </entry>",
  ].join("\n");

/** The feed: the posts newest first, as the tab lists them. `builtAt` is when
    it says it was last changed if there are no posts yet (Atom asks for a
    time); with posts, it's the newest one's. */
export function writingFeedXml(site: Site, builtAt: Date = new Date()): string {
  const self = site.fileUrl(writingFeedPath(site));
  const tabsPage = site.fileUrl(tabPath(site, site.main, WRITING_TAB));
  const updated = site.posts[0]?.posted ?? builtAt.toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${xmlSafe(site.main)}">
  <title>${xmlSafe(writingFeedTitle(site))}</title>
  <link rel="self" type="${WRITING_FEED_TYPE}" href="${xmlSafe(self)}"/>
  <link rel="alternate" type="text/html" href="${xmlSafe(tabsPage)}"/>
  <id>${xmlSafe(self)}</id>
  <updated>${updated}</updated>
  <author><name>${xmlSafe(site.config.name)}</name></author>
${site.posts.map((post) => entryOf(post, site.main)).join("\n")}
</feed>
`;
}
