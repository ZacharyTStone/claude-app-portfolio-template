/* A stand-in for every place the Writing tab's posts come from, so that no
   test reaches Qiita, Zenn, DEV or a blog: it answers from a file of what
   each would send. A build uses it only when the environment variable
   WRITING_FIXTURE names that file, which only the tests set, and then only
   for the users and feeds the file is for. Any other user gets what that
   place gives a user it doesn't have (a 404), and any other feed a 404, so
   the build stops: the file's made-up posts can't stand in for a real
   site's own. */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as v from "valibot";
import type { Fetch } from "../fetching.ts";
import { devArticlesAddress, devUserAddress } from "./dev.ts";
import { qiitaItemsAddress } from "./qiita.ts";
import { zennArticlesAddress, zennUserAddress } from "./zenn.ts";

/** The environment variable that names the fixture's file, from the repo's
    root: "tests/sample/writing.json". */
export const WRITING_FIXTURE = "WRITING_FIXTURE";

const AccountSchema = v.object({
  /** The user the posts are for. */
  user: v.string(),
  /** Every post the place would send for that user, in its order (newest
      first), as its API writes them: they're checked as the place's are. */
  posts: v.array(v.unknown()),
});

const FixtureSchema = v.object({
  qiita: v.optional(AccountSchema),
  zenn: v.optional(AccountSchema),
  dev: v.optional(AccountSchema),
  /** Each feed's address, and the file of what it sends, from the fixture's
      own folder. */
  feeds: v.optional(v.record(v.string(), v.string())),
});

type Account = v.InferOutput<typeof AccountSchema>;

/** A fixture, read: each feed's address with what it sends. */
export type Fixture = Omit<v.InferOutput<typeof FixtureSchema>, "feeds"> & { feeds: Record<string, string> };

/** Throws if the file isn't there, or isn't a fixture, or a feed's file isn't there. */
export function readFixture(file: string): Fixture {
  const fixture = v.parse(FixtureSchema, JSON.parse(readFileSync(file, "utf8")));
  const feeds = Object.entries(fixture.feeds ?? {}).map(([url, feedFile]) => [
    url,
    readFileSync(resolve(dirname(file), feedFile), "utf8"),
  ]);
  return { ...fixture, feeds: Object.fromEntries(feeds) };
}

/** What Qiita sends for an id it doesn't have, and the fixture for anything it doesn't hold. */
const notFound = () => Response.json({ message: "Not found", type: "not_found" }, { status: 404 });

/** The same address, whatever is asked after "?". */
const isAt = (asked: URL, address: string): boolean => {
  const at = new URL(address);
  return asked.origin === at.origin && asked.pathname === at.pathname;
};

const isFor = (asked: URL, parameter: string, account: Account | undefined): account is Account =>
  account !== undefined && asked.searchParams.get(parameter) === account.user;

/** A page of `posts`: the `page`th, of `perPage`. */
const pageOf = (posts: unknown[], page: number, perPage: number): unknown[] =>
  posts.slice((page - 1) * perPage, page * perPage);

/** Qiita: the user's items a page at a time. */
function qiitaAnswer(asked: URL, qiita: Account | undefined): Response | undefined {
  if (!qiita || !isAt(asked, qiitaItemsAddress(qiita.user, 1, 1))) return undefined;
  const [page, perPage] = [Number(asked.searchParams.get("page")), Number(asked.searchParams.get("per_page"))];
  return Response.json(pageOf(qiita.posts, page, perPage));
}

/** Zenn's articles, 48 a page, with the next page's number while there's one. */
const ZENN_PAGE = 48;

/** Zenn: the user, and their articles a page at a time. */
function zennAnswer(asked: URL, zenn: Account | undefined): Response | undefined {
  if (zenn && asked.href === zennUserAddress(zenn.user)) return Response.json({ user: { username: zenn.user } });
  if (!isAt(asked, zennArticlesAddress("", 1)) || !isFor(asked, "username", zenn)) return undefined;
  const page = Number(asked.searchParams.get("page"));
  const more = zenn.posts.length > page * ZENN_PAGE;
  return Response.json({ articles: pageOf(zenn.posts, page, ZENN_PAGE), next_page: more ? page + 1 : null });
}

/** DEV: the user, and their articles a page at a time; for anyone else, as
    DEV does, an empty list. */
function devAnswer(asked: URL, dev: Account | undefined): Response | undefined {
  if (dev && asked.href === devUserAddress(dev.user)) return Response.json({ username: dev.user });
  if (!isAt(asked, devArticlesAddress("", 1))) return undefined;
  if (!isFor(asked, "username", dev)) return Response.json([]);
  const [page, perPage] = [Number(asked.searchParams.get("page")), Number(asked.searchParams.get("per_page"))];
  return Response.json(pageOf(dev.posts, page, perPage));
}

/** Answers as each place would, from `fixture`, and anything it doesn't
    hold with a 404. */
export function fixtureFetch(fixture: Fixture): Fetch {
  return async (address) => {
    const asked = new URL(address);
    const feed = fixture.feeds[address];
    if (feed !== undefined) return new Response(feed, { headers: { "content-type": "application/xml" } });
    return (
      qiitaAnswer(asked, fixture.qiita) ??
      zennAnswer(asked, fixture.zenn) ??
      devAnswer(asked, fixture.dev) ??
      notFound()
    );
  };
}
