/* A GitHub user's recent public activity, from GitHub's REST API, as the
   details panel lists it: the public repos they pushed to most recently,
   from their public events. The build asks with no token unless the
   environment gives it one: GitHub answers one address 60 times an hour
   that way, and a build asks once or twice. What comes back is checked
   before anything of it reaches a page, and only what the panel shows is
   kept. */
import * as v from "valibot";
import { ACTIVITY_REPOS } from "../../config/activity.ts";
import type { Failure } from "../fetching.ts";
import { ask, readPages, type AskOptions, type Asking, type EventPage } from "./asking.ts";
import { inUtc, latestOnce, type Repo } from "./repo.ts";

/** The environment variable that may hold a token for the build to ask
    GitHub with. It's read by the build alone, and no page carries it. */
export const GITHUB_TOKEN = "GITHUB_TOKEN";

/** GitHub's API: the one address the token is ever sent to. */
export const GITHUB_API = "https://api.github.com";

/** Where a user's public events are, newest first, a page at a time. */
export const eventsAddress = (user: string, perPage: number): string =>
  `${GITHUB_API}/users/${encodeURIComponent(user)}/events/public?per_page=${perPage}`;

/** The most events GitHub gives in a page. */
const PAGE_SIZE = 100;

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

export type GitHubOptions = AskOptions & {
  /** A token to ask with, from GITHUB_TOKEN: none, unless the build's
      environment has one. */
  token?: string;
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

/** What only GitHub says no for: its hourly limit, used up, and the token. */
const refusedByGitHub =
  (withToken: boolean) =>
  (response: Response, message: string): Failure | undefined => {
    const { status } = response;
    const isLimited = status === 403 || status === 429;
    if (isLimited && response.headers.get("x-ratelimit-remaining") === "0") return rateLimited(response, withToken);
    if (status === 401 && withToken) {
      return { why: `GitHub refused the token in ${GITHUB_TOKEN}${message}: fix it, or unset it`, mightPass: false };
    }
    return undefined;
  };

/** The next page's address, from the Link header GitHub sends with a page
    that has one after it. Only ever an address of GitHub's API: the token,
    if there is one, goes nowhere else. */
function nextPage(response: Response): string | undefined {
  const next = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get("link") ?? "")?.[1];
  return next && URL.canParse(next) && new URL(next).origin === GITHUB_API ? next : undefined;
}

function askingFor(address: string, token: string | undefined): Asking<Event[]> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  const refused = refusedByGitHub(Boolean(token));
  return { service: "github", address, what: "a list of events", schema: v.array(EventSchema), headers, refused };
}

/** Each repo pushed to once, at its latest push, the latest first. Only a
    push counts, and only a public one. */
const reposPushedTo = (events: Event[]): Repo[] =>
  latestOnce(
    events
      .filter((event) => event.type === "PushEvent" && event.public)
      .map((push) => ({
        service: "github",
        name: push.repo.name,
        url: `https://github.com/${push.repo.name}`,
        pushed: inUtc(push.created_at),
      })),
  );

/** The public repos `user` pushed to most recently on GitHub, the latest
    first, as many as the panel lists, or fewer if their recent public
    events name fewer. Throws if GitHub can't be reached, refuses, or sends
    anything but a list of events. */
export async function githubRepos(user: string, options: GitHubOptions): Promise<Repo[]> {
  const readPage = async (address: string): Promise<EventPage<Event>> => {
    const { got, response } = await ask(askingFor(address, options.token), options);
    return { events: got, next: nextPage(response) };
  };
  const first = eventsAddress(user, options.perPage ?? PAGE_SIZE);
  const events = await readPages(first, readPage, (read) => reposPushedTo(read).length);
  return reposPushedTo(events).slice(0, ACTIVITY_REPOS);
}
