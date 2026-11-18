/* Every place the config's `writing` names, asked for its posts, and the
   posts of all of them as the Writing tab lists them: newest first, each
   once. A place that can't be had stops the build, as one could alone: a tab
   with one place's posts gone would say less than it should. */
import type { Writing } from "../../config/writing.ts";
import { asShowable } from "../../contracts/ask.ts";
import { DEV, devPosts } from "./dev.ts";
import { feedPosts, feedsOf } from "./feeds.ts";
import { newestFirst, type Post } from "./post.ts";
import { QIITA, qiitaPosts } from "./qiita.ts";
import type { SourceOptions } from "./source.ts";
import { ZENN, zennPosts } from "./zenn.ts";

/** A place the posts are fetched from, as what's said of it names it: "Qiita
    (alex-example)", "Medium (alex-example)", "Alex's blog". */
export type Source = { name: string; posts: () => Promise<Post[]> };

/** How the sources are asked: with each Qiita post's text, too, on a site
    whose viewer shows its posts. */
export type WritingOptions = SourceOptions & { bodies?: boolean | undefined };

/** The places `writing` names, in the order the config's type lists them. */
export function sourcesOf(writing: Writing, options: WritingOptions): Source[] {
  const { qiita, zenn, dev } = writing;
  const apis: Source[] = [
    ...(qiita ? [{ name: `${QIITA.place} (${qiita})`, posts: () => qiitaPosts(qiita, options) }] : []),
    ...(zenn ? [{ name: `${ZENN} (${zenn})`, posts: () => zennPosts(zenn, options) }] : []),
    ...(dev ? [{ name: `${DEV} (${dev})`, posts: () => devPosts(dev, options) }] : []),
  ];
  const feeds = feedsOf(writing).map((feed) => ({ name: feed.place, posts: () => feedPosts(feed, options) }));
  return [...apis, ...feeds];
}

/** Each post once, by its address: the first place's, where two feeds list
    the same post. */
const eachOnce = (posts: Post[]): Post[] =>
  posts.filter((post, at) => posts.findIndex((other) => other.url === post.url) === at);

/** A post as the tab keeps it: its title and tags with nothing hidden or
    reordered in them (asShowable), whatever the place sent. Ask's models
    read the titles as the site's text. Throws for a title of only
    characters no one sees. */
function showable(post: Post): Post {
  const title = asShowable(post.title);
  if (!title) throw new Error(`The post at ${post.url} has a title of only characters no one can see`);
  return { ...post, title, tags: post.tags.map(asShowable).filter(Boolean) };
}

/** Every post of every place `writing` names, newest first, or the newest
    `writing.latest` of them. Throws, saying which place and why, if any
    can't be had. */
export async function postsOfEveryPlace(writing: Writing, options: WritingOptions): Promise<Post[]> {
  const fetched = await Promise.all(sourcesOf(writing, options).map((source) => source.posts()));
  return newestFirst(eachOnce(fetched.flat().map(showable))).slice(0, writing.latest);
}

/** How many posts came from each place, as the build says it: "3 on Qiita,
    2 on Zenn". */
export function postsPerPlace(posts: Post[]): string {
  const counts = new Map<string, number>();
  for (const { place } of posts) counts.set(place, (counts.get(place) ?? 0) + 1);
  return [...counts].map(([place, count]) => `${count} on ${place}`).join(", ");
}
