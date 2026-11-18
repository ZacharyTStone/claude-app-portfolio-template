/* A Zenn user's articles, from Zenn's API, as the Writing tab lists them.
   Zenn's list of articles has a trap: asked for a user it doesn't have, it
   doesn't say so, but answers with everyone's latest articles. So the build
   first asks for the user, which Zenn answers with a 404 if there's no such
   one, and then keeps an article only if it's that user's own: a list with
   anyone else's in it stops the build. */
import * as v from "valibot";
import { inTimeZone } from "./posted.ts";
import { newestFirst, type Post } from "./post.ts";
import { askForJson, type Asked, type SourceOptions } from "./source.ts";

/** What a page calls Zenn. */
export const ZENN = "Zenn";

const ORIGIN = "https://zenn.dev";

/** Where a user is, and their articles, a page at a time, newest first. */
export const zennUserAddress = (user: string): string => `${ORIGIN}/api/users/${encodeURIComponent(user)}`;
export const zennArticlesAddress = (user: string, page: number): string =>
  `${ORIGIN}/api/articles?username=${encodeURIComponent(user)}&order=latest&page=${page}`;

/** The most pages the build follows: far more articles than anyone has. */
const LAST_PAGE = 50;

const ASKED: Asked = { service: ZENN, notFound: "Zenn has no user by that name" };

const UserSchema = v.object({ user: v.object({ username: v.string() }) });

/** An article as Zenn's API has it, but for what the site doesn't show. */
const ArticleSchema = v.object({
  slug: v.pipe(v.string(), v.regex(/^[\w-]+$/)),
  title: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  // A path on Zenn, under the user or a publication ("/p/…"): a card links
  // there, and nowhere else.
  path: v.pipe(v.string(), v.regex(/^(\/p)?\/[\w-]+\/articles\/[\w-]+$/)),
  published_at: v.pipe(v.string(), v.isoTimestamp()),
  liked_count: v.pipe(v.number(), v.integer(), v.minValue(0)),
  user: v.object({ username: v.string() }),
});

type Article = v.InferOutput<typeof ArticleSchema>;

const PageSchema = v.object({
  articles: v.array(ArticleSchema),
  next_page: v.nullish(v.pipe(v.number(), v.integer())),
});

const isTheUsers = (user: string) => (article: Article) => article.user.username.toLowerCase() === user.toLowerCase();

const postOf = (article: Article, timeZone: string): Post => ({
  id: `zenn-${article.slug}`,
  title: article.title,
  url: `${ORIGIN}${article.path}`,
  posted: inTimeZone(Date.parse(article.published_at), timeZone),
  place: ZENN,
  likes: { count: article.liked_count },
  tags: [],
});

/** Every article of `user`'s, newest first. Throws if Zenn can't be
    reached, has no such user, or sends anything but their articles. */
export async function zennPosts(user: string, options: SourceOptions): Promise<Post[]> {
  await askForJson(zennUserAddress(user), UserSchema, { asked: ASKED, what: "a user as its API sends one" }, options);
  const articles: Article[] = [];
  for (let page: number | null | undefined = 1; page && page <= LAST_PAGE;) {
    const address = zennArticlesAddress(user, page);
    const answer = await askForJson(address, PageSchema, { asked: ASKED, what: "a list of articles" }, options);
    if (!answer.articles.every(isTheUsers(user))) {
      throw new Error(`Zenn's list of ${user}'s articles has someone else's in it, at ${address}`);
    }
    articles.push(...answer.articles);
    page = answer.next_page;
  }
  return newestFirst(articles.map((article) => postOf(article, options.timeZone)));
}
