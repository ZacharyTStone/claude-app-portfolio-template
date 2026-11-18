/* What asking GitHub's, GitLab's and Codeberg's APIs has in common
   (github.ts, gitlab.ts, codeberg.ts): each request has the time limit and
   the one more try (../fetching.ts), each answer is checked against what
   the API sends before anything of it is used, a refusal is said in the
   place's own words, and the pages of events are read only while they
   name too few repos. */
import * as v from "valibot";
import { ACTIVITY_REPOS, ACTIVITY_SERVICES, type ActivityService } from "../../config/activity.ts";
import { unreachable, WAIT_MS, withOneMoreTry, type Failure, type Fetch } from "../fetching.ts";

/** How a place is asked: the same for each, but for GitHub's token. */
export type AskOptions = {
  fetch: Fetch;
  /** Events a page: as many as the API gives, unless a test asks for fewer
      to see the pages followed. */
  perPage?: number;
  /** How long a failed request waits before it's tried again: 2 seconds,
      unless a test has no time to wait. */
  retryAfterMs?: number;
};

/** One request: where, and what its answer has to be. */
export type Asking<Got> = {
  service: ActivityService;
  address: string;
  /** What the answer is, as a problem says it: "a list of events". */
  what: string;
  schema: v.GenericSchema<unknown, Got>;
  headers: Record<string, string>;
  /** What's said of a refusal before what refusal() would say, with the
      place's message in brackets (" (Not Found)") or "": GitHub's hourly
      limit, or its refusal of the token. */
  refused?: (response: Response, message: string) => Failure | undefined;
  /** What a 404 gives in place of a failure: none, for a project GitLab
      shows no one but its members. */
  whenNotFound?: Got;
};

/** An answer, checked, and the response it came in, for its headers. */
export type Answered<Got> = { got: Got; response: Response };

/** What each of the three sends with a refusal: { "message": "Not Found" }. */
const RefusalSchema = v.object({ message: v.string() });

/** A busy or broken server may answer the next request; one that says no to
    this one, or has no such user, won't. */
async function refusal<Got>(asking: Asking<Got>, response: Response): Promise<Failure> {
  const name = ACTIVITY_SERVICES[asking.service];
  const said = v.safeParse(RefusalSchema, await response.json().catch(() => undefined));
  const message = said.success ? ` (${said.output.message})` : "";
  const { status } = response;
  const ownWords = asking.refused?.(response, message);
  if (ownWords) return ownWords;
  if (status === 404) return { why: `${name} has no user by that name${message}`, mightPass: false };
  return { why: `${name} answered ${status}${message}`, mightPass: status >= 500 };
}

function misshapen<Got>(asking: Asking<Got>, issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): Failure {
  const [first] = issues;
  const where = v.getDotPath(first) ?? "the answer";
  return {
    why: `${ACTIVITY_SERVICES[asking.service]}'s answer isn't ${asking.what} as its API sends one (${where}: ${first.message})`,
    mightPass: false,
  };
}

async function askOnce<Got>(asking: Asking<Got>, options: AskOptions): Promise<Answered<Got> | Failure> {
  const response = await options
    .fetch(asking.address, { headers: asking.headers, signal: AbortSignal.timeout(WAIT_MS.answer) })
    .catch((error: unknown) => unreachable(ACTIVITY_SERVICES[asking.service], error));
  if (!(response instanceof Response)) return response;
  if (response.status === 404 && asking.whenNotFound !== undefined) return { got: asking.whenNotFound, response };
  if (!response.ok) return refusal(asking, response);
  const parsed = v.safeParse(asking.schema, await response.json().catch(() => undefined));
  return parsed.success ? { got: parsed.output, response } : misshapen(asking, parsed.issues);
}

/** The answer to `asking`, tried once more after a failure that might pass.
    Throws, saying why and at which address, if there's still none. */
export const ask = <Got>(asking: Asking<Got>, options: AskOptions): Promise<Answered<Got>> =>
  withOneMoreTry(asking.address, () => askOnce(asking, options), options.retryAfterMs);

/** How many pages of events are read at most, should the first not name
    enough repos. */
const MOST_PAGES = 3;

/** A page of events, and the address of the page after it, if there's one. */
export type EventPage<Event> = { events: Event[]; next: string | undefined };

/** The events of the pages from `first` on, as `readPage` reads each, while
    the events so far name fewer repos than the panel lists (`reposIn`
    says how many they name). */
export async function readPages<Event>(
  first: string,
  readPage: (address: string) => Promise<EventPage<Event>>,
  reposIn: (events: Event[]) => number,
): Promise<Event[]> {
  const events: Event[] = [];
  let address: string | undefined = first;
  for (let page = 1; address !== undefined && page <= MOST_PAGES; page++) {
    const read = await readPage(address);
    events.push(...read.events);
    address = reposIn(events) < ACTIVITY_REPOS ? read.next : undefined;
  }
  return events;
}

/** The next page's address, for an API that has a `page` to ask by and
    no link to the next: `address` with the page after its own, if its
    answer was a full page (`count` of `perPage`), and so may have more
    after it. */
export function pageAfter(address: string, count: number, perPage: number): string | undefined {
  if (count < perPage) return undefined;
  const next = new URL(address);
  next.searchParams.set("page", String(Number(next.searchParams.get("page") ?? 1) + 1));
  return next.href;
}
