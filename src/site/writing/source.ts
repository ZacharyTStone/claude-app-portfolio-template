/* What the Writing tab's sources share (sources.ts): how each is asked, and
   what's said when it can't be. Every request has the time limit and the one
   more try of src/site/fetching.ts, and what comes back is checked before
   any of it is used. */
import * as v from "valibot";
import { unreachable, WAIT_MS, withOneMoreTry, type Failure, type Fetch } from "../fetching.ts";

/** How a source is asked, by the build or a test. */
export type SourceOptions = {
  fetch: Fetch;
  /** The config's timezone, the owner's clock, which a post's time is
      written in (posted.ts). */
  timeZone: string;
  /** How long a failed request waits before it's tried again: 2 seconds,
      unless a test has no time to wait. */
  retryAfterMs?: number;
};

/** Who's asked, as what's said of it names it. */
export type Asked = {
  /** "Zenn", as in "Zenn answered 503". */
  service: string;
  /** What a 404 means there: "Zenn has no user by that name". */
  notFound: string;
};

/** The most a feed may be, in bytes: far more than any blog's. */
const MOST_BYTES = 5_000_000;

/** A busy or broken server may answer the next request; one that says no to
    this one, or has no such user, won't. */
function refusal(response: Response, asked: Asked): Failure {
  const why = response.status === 404 ? asked.notFound : `${asked.service} answered ${response.status}`;
  return { why, mightPass: response.status >= 500 || response.status === 429 };
}

/** What's said of an answer that isn't the shape `what` is: "Zenn's answer
    isn't a list of articles as its API sends one (articles.0.title: …)". */
function misshapen(asked: Asked, what: string, issues: v.BaseIssue<unknown>[]): Failure {
  const [first] = issues;
  const where = (first && v.getDotPath(first)) ?? "the answer";
  return {
    why: `${asked.service}'s answer isn't ${what} (${where}: ${first?.message ?? "no answer"})`,
    mightPass: false,
  };
}

/** The answer at `address`, if it came, was a success and wasn't too big. */
async function answerAt(address: string, accept: string, asked: Asked, fetch: Fetch): Promise<Response | Failure> {
  const init = { headers: { accept }, signal: AbortSignal.timeout(WAIT_MS.answer) };
  const response = await fetch(address, init).catch((error: unknown) => unreachable(asked.service, error));
  if (!(response instanceof Response)) return response;
  if (!response.ok) return refusal(response, asked);
  const size = Number(response.headers.get("content-length") ?? 0);
  return size > MOST_BYTES ? { why: `${asked.service} sent more than 5 MB`, mightPass: false } : response;
}

/** The JSON at `address`, of `schema`'s shape (`what` says which, for a
    problem). Throws, saying where and why, if it can't be had. */
export function askForJson<Got>(
  address: string,
  schema: v.GenericSchema<unknown, Got>,
  { asked, what }: { asked: Asked; what: string },
  options: SourceOptions,
): Promise<Got> {
  const tryOnce = async (): Promise<Got | Failure> => {
    const response = await answerAt(address, "application/json", asked, options.fetch);
    if (!(response instanceof Response)) return response;
    const parsed = v.safeParse(schema, await response.json().catch(() => undefined));
    return parsed.success ? parsed.output : misshapen(asked, what, parsed.issues);
  };
  return withOneMoreTry(address, tryOnce, options.retryAfterMs);
}

/** A feed's text, and the address it came from after any redirect. */
export type FeedText = { text: string; from: string };

/** The feed at `address`, as text. Throws, saying where and why, if it
    can't be had. */
export function askForFeed(address: string, asked: Asked, options: SourceOptions): Promise<FeedText> {
  const tryOnce = async (): Promise<FeedText | Failure> => {
    const accept = "application/rss+xml, application/atom+xml, application/xml, text/xml";
    const response = await answerAt(address, accept, asked, options.fetch);
    if (!(response instanceof Response)) return response;
    const text = await response.text();
    if (text.length > MOST_BYTES) return { why: `${asked.service} sent more than 5 MB`, mightPass: false };
    return { text, from: response.url || address };
  };
  return withOneMoreTry(address, tryOnce, options.retryAfterMs);
}
