/* A Qiita user's public posts, from Qiita's API (v2), as the Writing tab
   lists them. The build asks once for every hundred posts, with no token:
   Qiita answers one address about 60 times an hour that way. What comes
   back is checked before anything of it reaches a page, and only what the
   tab shows is kept. */
import * as v from "valibot";
import { unreachable, WAIT_MS, withOneMoreTry, type Failure, type Fetch } from "../fetching.ts";
import { newestFirst, type Post } from "./post.ts";

/** Where a user's posts are, newest first, a page at a time. */
export const qiitaItemsAddress = (user: string, page: number, perPage: number): string =>
  `https://qiita.com/api/v2/users/${encodeURIComponent(user)}/items?page=${page}&per_page=${perPage}`;

/** The most posts Qiita gives in a page, and the last page it serves. */
const PAGES = { size: 100, last: 100 } as const;

/** An item as Qiita's API has it, but for what the tab doesn't show:
    v.object leaves out every other field, the post's body among them. */
const ItemSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  // A card links to Qiita, and to nowhere else.
  url: v.pipe(v.string(), v.startsWith("https://qiita.com/")),
  created_at: v.pipe(v.string(), v.isoTimestamp()),
  likes_count: v.pipe(v.number(), v.integer(), v.minValue(0)),
  tags: v.array(v.object({ name: v.string() })),
  private: v.boolean(),
});

type Item = v.InferOutput<typeof ItemSchema>;

const PageSchema = v.array(ItemSchema);

/** What Qiita sends with a refusal: { "message": "Not found", "type": "not_found" }. */
const RefusalSchema = v.object({ type: v.string() });

export type QiitaOptions = {
  fetch: Fetch;
  /** Posts a page: 100, unless a test asks for fewer to see the pages followed. */
  perPage?: number;
  /** How long a failed request waits before it's tried again: 2 seconds,
      unless a test has no time to wait. */
  retryAfterMs?: number;
};

/** A busy or broken server may answer the next request; one that says no to
    this one, or has no such user, won't. */
async function refusal(response: Response): Promise<Failure> {
  const said = v.safeParse(RefusalSchema, await response.json().catch(() => undefined));
  const kind = said.success ? ` (${said.output.type})` : "";
  const why =
    response.status === 404 ? `Qiita has no user by that id${kind}` : `Qiita answered ${response.status}${kind}`;
  return { why, mightPass: response.status >= 500 || response.status === 429 };
}

function misshapen(issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): Failure {
  const [first] = issues;
  const where = v.getDotPath(first) ?? "the answer";
  return {
    why: `Qiita's answer isn't a list of posts as its API sends one (${where}: ${first.message})`,
    mightPass: false,
  };
}

async function tryPage(address: string, fetch: Fetch): Promise<Item[] | Failure> {
  const init = { headers: { accept: "application/json" }, signal: AbortSignal.timeout(WAIT_MS.answer) };
  const response = await fetch(address, init).catch((error: unknown) => unreachable("Qiita", error));
  if (!(response instanceof Response)) return response;
  if (!response.ok) return refusal(response);
  const parsed = v.safeParse(PageSchema, await response.json().catch(() => undefined));
  return parsed.success ? parsed.output : misshapen(parsed.issues);
}

/** One page's items, with one more try after a failure that might pass.
    Throws, saying where and why, if there's still no page. */
const pageOfItems = (address: string, options: QiitaOptions): Promise<Item[]> =>
  withOneMoreTry(address, () => tryPage(address, options.fetch), options.retryAfterMs);

const postOf = (item: Item): Post => ({
  title: item.title,
  url: item.url,
  posted: item.created_at,
  likes: item.likes_count,
  tags: item.tags.map((tag) => tag.name),
});

/** Every public post of `user`'s, newest first, following the pages until
    one comes back short. Throws if Qiita can't be reached, refuses, or
    sends anything but a list of posts. */
export async function qiitaPosts(user: string, options: QiitaOptions): Promise<Post[]> {
  const perPage = options.perPage ?? PAGES.size;
  const items: Item[] = [];
  for (let page = 1; page <= PAGES.last; page++) {
    const onThisPage = await pageOfItems(qiitaItemsAddress(user, page, perPage), options);
    items.push(...onThisPage);
    if (onThisPage.length < perPage) break;
  }
  return newestFirst(items.filter((item) => !item.private).map(postOf));
}
