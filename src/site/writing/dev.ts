/* A DEV (dev.to) user's articles, from DEV's API (Forem's), as the Writing
   tab lists them. DEV answers a list for a user it doesn't have as an empty
   one, as it would for a user with no articles yet, so the build first asks
   for the user, which DEV answers with a 404 if there's no such one. */
import * as v from "valibot";
import { inTimeZone } from "./posted.ts";
import { newestFirst, type Post } from "./post.ts";
import { askForJson, type Asked, type SourceOptions } from "./source.ts";

/** What a page calls DEV. */
export const DEV = "DEV";

const ORIGIN = "https://dev.to";

/** Articles a page: the most DEV gives. */
const PER_PAGE = 1000;

/** The most pages the build follows: far more articles than anyone has. */
const LAST_PAGE = 10;

/** Where a user is, and their published articles, a page at a time. */
export const devUserAddress = (user: string): string =>
  `${ORIGIN}/api/users/by_username?url=${encodeURIComponent(user)}`;
export const devArticlesAddress = (user: string, page: number, perPage = PER_PAGE): string =>
  `${ORIGIN}/api/articles?username=${encodeURIComponent(user)}&per_page=${perPage}&page=${page}`;

const ASKED: Asked = { service: DEV, notFound: "DEV has no user by that name" };

const UserSchema = v.object({ username: v.string() });

/** An article as DEV's API has it, but for what the site doesn't show. */
const ArticleSchema = v.object({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  title: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  // A card links to DEV, and to nowhere else.
  url: v.pipe(v.string(), v.startsWith(`${ORIGIN}/`)),
  published_timestamp: v.pipe(v.string(), v.isoTimestamp()),
  public_reactions_count: v.pipe(v.number(), v.integer(), v.minValue(0)),
  tag_list: v.array(v.string()),
  user: v.object({ username: v.string() }),
});

type Article = v.InferOutput<typeof ArticleSchema>;

const PageSchema = v.array(ArticleSchema);

const postOf = (article: Article, timeZone: string): Post => ({
  id: `dev-${article.id}`,
  title: article.title,
  url: article.url,
  posted: inTimeZone(Date.parse(article.published_timestamp), timeZone),
  place: DEV,
  likes: { count: article.public_reactions_count },
  tags: article.tag_list,
});

/** DEV can be asked for fewer a page, as a test does to see the pages followed. */
export type DevOptions = SourceOptions & { perPage?: number };

/** Every published article of `user`'s, newest first, following the pages
    until one comes back short. Throws if DEV can't be reached, has no such
    user, or sends anything but their articles. */
export async function devPosts(user: string, options: DevOptions): Promise<Post[]> {
  await askForJson(devUserAddress(user), UserSchema, { asked: ASKED, what: "a user as its API sends one" }, options);
  const perPage = options.perPage ?? PER_PAGE;
  const articles: Article[] = [];
  for (let page = 1; page <= LAST_PAGE; page++) {
    const address = devArticlesAddress(user, page, perPage);
    const onThisPage = await askForJson(address, PageSchema, { asked: ASKED, what: "a list of articles" }, options);
    if (!onThisPage.every((article) => article.user.username.toLowerCase() === user.toLowerCase())) {
      throw new Error(`DEV's list of ${user}'s articles has someone else's in it, at ${address}`);
    }
    articles.push(...onThisPage);
    if (onThisPage.length < perPage) break;
  }
  return newestFirst(articles.map((article) => postOf(article, options.timeZone)));
}
