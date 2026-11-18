/* The Writing tab's posts from a blog's RSS or Atom feed: note, Medium,
   Substack, Hatena Blog, or any other the config lists in `writing.feeds`.
   A feed lists only a blog's latest posts, as many as the blog puts in it.
   Each post's link has to be to the blog itself (the feed's own site, or the
   one the feed says it's for, or a subdomain of either), and its time has to
   be one: anything else stops the build, as an API's answer of the wrong
   shape does. Of each post only its title, address, time and tags are kept,
   never its text. */
import { createHash } from "node:crypto";
import type { Writing, WritingFeed } from "../../config/writing.ts";
import { readFeed, type FeedItem } from "./feed-xml.ts";
import { postedIn } from "./posted.ts";
import { newestFirst, type Post } from "./post.ts";
import { askForFeed, type SourceOptions } from "./source.ts";

/** A feed the build reads, as the config's name for it says. */
export type Feed = {
  /** What it's called in a post's id: "note", "feed". */
  key: string;
  url: string;
  /** What a page calls the place: "note", "Medium", a blog's name. */
  place: string;
  /** Whether a post may link anywhere: Medium's publications have domains
      of their own. */
  linksAnywhere?: boolean;
  /** A post's address as a card links to it: Medium's without the
      "?source=rss-…" it adds. */
  tidy?: (url: URL) => URL;
};

const withoutSource = (url: URL): URL => {
  const tidied = new URL(url);
  tidied.searchParams.delete("source");
  return tidied;
};

/** The platforms the config names by account, in the order the tab is made. */
const PRESETS = {
  note: (id: string): Feed => ({ key: "note", url: `https://note.com/${id}/rss`, place: "note" }),
  medium: (user: string): Feed => ({
    key: "medium",
    url: `https://medium.com/feed/@${user}`,
    place: "Medium",
    linksAnywhere: true,
    tidy: withoutSource,
  }),
  substack: (name: string): Feed => ({ key: "substack", url: `https://${name}.substack.com/feed`, place: "Substack" }),
  hatena: (blog: string): Feed => ({ key: "hatena", url: `https://${blog}/feed`, place: "Hatena Blog" }),
} as const satisfies Record<string, (account: string) => Feed>;

const hostOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

const ofTheConfig = (feed: WritingFeed): Feed => ({ key: "feed", url: feed.url, place: feed.name ?? hostOf(feed.url) });

/** Every feed `writing` names: its platforms' first, then its own. */
export function feedsOf(writing: Writing): Feed[] {
  const presets = (Object.keys(PRESETS) as (keyof typeof PRESETS)[]).flatMap((name) => {
    const account = writing[name];
    return account ? [PRESETS[name](account)] : [];
  });
  return [...presets, ...(writing.feeds ?? []).map(ofTheConfig)];
}

/** Whether `host` is one of `hosts`, or under one ("blog.example.com" under
    "example.com"). */
const isOnOneOf = (host: string, hosts: string[]): boolean =>
  hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));

/** A post's address, if it's a web address to the blog, as a card links to it. */
function linkOf(item: FeedItem, feed: Feed, hosts: string[]): string | undefined {
  if (!item.link || !URL.canParse(item.link)) return undefined;
  const url = new URL(item.link);
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  if (!feed.linksAnywhere && !isOnOneOf(url.hostname.replace(/^www\./, ""), hosts)) return undefined;
  return (feed.tidy ? feed.tidy(url) : url).href;
}

const idOf = (feed: Feed, url: string): string =>
  `${feed.key}-${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;

/** A post of `item`, or why it can't be one. */
function postOf(item: FeedItem, feed: Feed, { hosts, timeZone }: { hosts: string[]; timeZone: string }): Post | string {
  const url = linkOf(item, feed, hosts);
  if (!item.title) return "a post with no title";
  const which = `a post, "${item.title}",`;
  if (!url) return item.link ? `${which} that links to ${item.link}, off the blog's own site` : `${which} with no link`;
  const posted = item.date ? postedIn(item.date, timeZone) : undefined;
  if (!posted) return `${which} with no time it was posted, or one that isn't a time`;
  return { id: idOf(feed, url), title: item.title, url, posted, place: feed.place, tags: item.tags };
}

/** The posts of `feed`, newest first. Throws if it can't be fetched, isn't
    a feed, or has a post that isn't one. */
export async function feedPosts(feed: Feed, options: SourceOptions): Promise<Post[]> {
  const asked = { service: feed.place, notFound: `${feed.place} has no feed at that address` };
  const { text, from } = await askForFeed(feed.url, asked, options);
  const read = readFeed(text);
  if (typeof read === "string") throw new Error(`${feed.place}'s feed can't be read: ${read}, at ${feed.url}`);
  const site = read.site && URL.canParse(read.site) ? [hostOf(read.site)] : [];
  const hosts = [hostOf(feed.url), hostOf(from), ...site];
  const posts = read.items.map((item) => postOf(item, feed, { hosts, timeZone: options.timeZone }));
  const problem = posts.find((post) => typeof post === "string");
  if (problem !== undefined) throw new Error(`${feed.place}'s feed has ${problem}, at ${feed.url}`);
  return newestFirst(posts.filter((post) => typeof post !== "string"));
}
