/* A GitHub user's recent public activity, from GitHub's REST API, as the
   details panel lists it: the public repos they pushed to most recently,
   from their public events. The build asks with no token unless the
   environment gives it one: GitHub answers one address 60 times an hour
   that way, and a build asks once or twice. What comes back is checked
   before anything of it reaches a page, and only what the panel shows is
   kept. */
import * as v from "valibot";
import { ACTIVITY_REPOS } from "../../config/activity.ts";
import { unreachable, WAIT_MS, withOneMoreTry, type Failure, type Fetch } from "../fetching.ts";

/** A public repo the user pushed to, as the panel lists it. */
export type Repo = {
  /** Its owner and name, as GitHub writes them: "alex-example/notes". */
  name: string;
  /** Its page: "https://github.com/alex-example/notes". */
  url: string;
  /** When the user last pushed to it, in UTC: "2026-11-12T03:04:05Z". */
  pushed: string;
};

/** The environment variable that may hold a token for the build to ask
    GitHub with. It's read by the build alone, and no page carries it. */
export const GITHUB_TOKEN = "GITHUB_TOKEN";

const API = "https://api.github.com";

/** Where a user's public events are, newest first, a page at a time. */
export const eventsAddress = (user: string, perPage: number): string =>
  `${API}/users/${encodeURIComponent(user)}/events/public?per_page=${perPage}`;

/** The most events GitHub gives in a page, and how many pages the build
    reads at most, should the first not name enough repos. */
const PAGES = { size: 100, most: 3 } as const;

/** "alex-example/notes": an owner and a repo, as a path on github.com. */
const REPO_NAME = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

/** An event as GitHub's API has it, but for what the panel doesn't show:
    v.object leaves out every other field, what was pushed among them. */
const EventSchema = v.object({
  type: v.string(),
  public: v.boolean(),
  created_at: v.pipe(v.string(), v.isoTimestamp()),
  repo: v.object({ name: v.pipe(v.string(), v.regex(REPO_NAME)) }),
});

type Event = v.InferOutput<typeof EventSchema>;

const PageSchema = v.array(EventSchema);

/** What GitHub sends with a refusal: { "message": "Not Found", … }. */
const RefusalSchema = v.object({ message: v.string() });

export type GitHubOptions = {
  fetch: Fetch;
  /** A token to ask with, from GITHUB_TOKEN: none, unless the build's
      environment has one. */
  token?: string;
  /** Events a page: 100, unless a test asks for fewer to see the pages followed. */
  perPage?: number;
  /** How long a failed request waits before it's tried again: 2 seconds,
      unless a test has no time to wait. */
  retryAfterMs?: number;
};

/** "14:05 UTC", from the epoch seconds GitHub's x-ratelimit-reset gives. */
const utcTime = (epochSeconds: number): string =>
  `${new Date(epochSeconds * 1000).toISOString().slice("YYYY-MM-DDT".length, "YYYY-MM-DDTHH:MM".length)} UTC`;

/** GitHub's hourly limit is used up: no try in the next two seconds passes,
    so this says when one will, and how to ask with more room. */
function rateLimited(response: Response, withToken: boolean): Failure {
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  const until = Number.isFinite(reset) && reset > 0 ? ` until ${utcTime(reset)}` : "";
  const why = withToken
    ? `GitHub's limit of requests for the token in ${GITHUB_TOKEN} is used up${until}: build again then`
    : `GitHub's limit of 60 requests an hour without a token is used up for this machine's address${until}: build again then, or give the build a token in ${GITHUB_TOKEN}`;
  return { why, mightPass: false };
}

/** A busy or broken server may answer the next request; one that says no to
    this one, or has no such user, won't. */
async function refusal(response: Response, withToken: boolean): Promise<Failure> {
  const { status } = response;
  const isLimited = status === 403 || status === 429;
  if (isLimited && response.headers.get("x-ratelimit-remaining") === "0") return rateLimited(response, withToken);
  const said = v.safeParse(RefusalSchema, await response.json().catch(() => undefined));
  const message = said.success ? ` (${said.output.message})` : "";
  if (status === 404) return { why: `GitHub has no user by that name${message}`, mightPass: false };
  if (status === 401 && withToken) {
    return { why: `GitHub refused the token in ${GITHUB_TOKEN}${message}: fix it, or unset it`, mightPass: false };
  }
  return { why: `GitHub answered ${status}${message}`, mightPass: status >= 500 };
}

function misshapen(issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): Failure {
  const [first] = issues;
  const where = v.getDotPath(first) ?? "the answer";
  return {
    why: `GitHub's answer isn't a list of events as its API sends one (${where}: ${first.message})`,
    mightPass: false,
  };
}

/** The next page's address, from the Link header GitHub sends with a page
    that has one after it. Only ever an address of GitHub's API: the token,
    if there is one, goes nowhere else. */
function nextPage(response: Response): string | undefined {
  const next = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get("link") ?? "")?.[1];
  return next && URL.canParse(next) && new URL(next).origin === API ? next : undefined;
}

type Page = { events: Event[]; next: string | undefined };

function requestFor(token: string | undefined): RequestInit {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  return { headers, signal: AbortSignal.timeout(WAIT_MS.answer) };
}

async function tryPage(address: string, options: GitHubOptions): Promise<Page | Failure> {
  const response = await options
    .fetch(address, requestFor(options.token))
    .catch((error: unknown) => unreachable("GitHub", error));
  if (!(response instanceof Response)) return response;
  if (!response.ok) return refusal(response, Boolean(options.token));
  const parsed = v.safeParse(PageSchema, await response.json().catch(() => undefined));
  return parsed.success ? { events: parsed.output, next: nextPage(response) } : misshapen(parsed.issues);
}

/** Each repo pushed to once, at its latest push, the latest first. Only a
    push counts, and only a public one. */
function reposPushedTo(events: Event[]): Repo[] {
  const pushes = events
    .filter((event) => event.type === "PushEvent" && event.public)
    .toSorted((one, other) => Date.parse(other.created_at) - Date.parse(one.created_at));
  const repos = new Map<string, Repo>();
  for (const push of pushes) {
    const key = push.repo.name.toLowerCase();
    if (repos.has(key)) continue;
    repos.set(key, { name: push.repo.name, url: `https://github.com/${push.repo.name}`, pushed: push.created_at });
  }
  return [...repos.values()];
}

/** The public repos `user` pushed to most recently, the latest first, as
    many as the panel lists, or fewer if their recent public events name
    fewer. Throws if GitHub can't be reached, refuses, or sends anything
    but a list of events. */
export async function recentRepos(user: string, options: GitHubOptions): Promise<Repo[]> {
  const events: Event[] = [];
  let address: string | undefined = eventsAddress(user, options.perPage ?? PAGES.size);
  for (let page = 1; address !== undefined && page <= PAGES.most; page++) {
    const asking: string = address;
    const read = await withOneMoreTry(asking, () => tryPage(asking, options), options.retryAfterMs);
    events.push(...read.events);
    address = reposPushedTo(events).length < ACTIVITY_REPOS ? read.next : undefined;
  }
  return reposPushedTo(events).slice(0, ACTIVITY_REPOS);
}
