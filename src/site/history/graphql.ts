/* How the build asks GitHub's GraphQL API, which answers no request
   without a token: a POST of the query with the token from GITHUB_TOKEN,
   which goes to api.github.com and nowhere else, never into a page, a log
   line or an error. Each request has the time limit and the one more try
   the build's other requests have (../fetching.ts). What comes back is
   checked against the query's schema before any of it is kept. */
import * as v from "valibot";
import { GITHUB_TOKEN } from "../activity/github.ts";
import { unreachable, WAIT_MS, withOneMoreTry, type Failure, type Fetch } from "../fetching.ts";

/** Where every query goes. */
export const GRAPHQL_ADDRESS = "https://api.github.com/graphql";

export type AskOptions = {
  fetch: Fetch;
  /** The token from GITHUB_TOKEN. Only the tests' stand-in for GitHub
      answers without one. */
  token?: string;
  /** How long a failed request waits before it's tried again: 2 seconds,
      unless a test has no time to wait. */
  retryAfterMs?: number;
};

/** What GitHub says went wrong, beside or in place of the data: a user it
    has no such name for is { type: "NOT_FOUND", message: "Could not
    resolve to a User with the login of 'x'." }. */
const ErrorsSchema = v.array(v.object({ type: v.optional(v.string()), message: v.string() }));

const AnswerSchema = v.object({ data: v.optional(v.unknown()), errors: v.optional(ErrorsSchema) });

/** What GitHub sends with a refusal of the request itself: { "message":
    "Bad credentials", … }. */
const RefusalSchema = v.object({ message: v.string() });

/** "14:05 UTC", from the epoch seconds GitHub's x-ratelimit-reset gives. */
const utcTime = (epochSeconds: number): string =>
  `${new Date(epochSeconds * 1000).toISOString().slice("YYYY-MM-DDT".length, "YYYY-MM-DDTHH:MM".length)} UTC`;

/** The token's share of GitHub's hourly limit is used up: no try in the
    next two seconds passes, so this says when one will. */
function rateLimited(response: Response): Failure {
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  const until = Number.isFinite(reset) && reset > 0 ? ` until ${utcTime(reset)}` : "";
  return {
    why: `GitHub's limit for the token in ${GITHUB_TOKEN} is used up${until}: build again then`,
    mightPass: false,
  };
}

const isLimited = (response: Response): boolean =>
  [403, 429].includes(response.status) && response.headers.get("x-ratelimit-remaining") === "0";

/** A request GitHub refused: a busy or broken server may answer the next
    one; a token it doesn't take won't be taken a moment later. */
async function refusal(response: Response): Promise<Failure> {
  if (isLimited(response)) return rateLimited(response);
  const said = v.safeParse(RefusalSchema, await response.json().catch(() => undefined));
  const message = said.success ? ` (${said.output.message})` : "";
  if (response.status === 401) {
    return {
      why: `GitHub refused the token in ${GITHUB_TOKEN}${message}: give the build one it takes`,
      mightPass: false,
    };
  }
  return { why: `GitHub answered ${response.status}${message}`, mightPass: response.status >= 500 };
}

/** A query GitHub answered with errors: no such user, the limit used up,
    or something on its side (a query that took too long), which might
    pass. */
function errorsSaid(errors: v.InferOutput<typeof ErrorsSchema>, response: Response): Failure {
  const [first] = errors;
  const said = first ? ` (${first.message})` : "";
  if (errors.some((error) => error.type === "NOT_FOUND")) {
    return { why: `GitHub has no user by that name${said}`, mightPass: false };
  }
  if (errors.some((error) => error.type === "RATE_LIMITED")) return rateLimited(response);
  return { why: `GitHub couldn't answer the query${said}`, mightPass: true };
}

function misshapen(issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): Failure {
  const [first] = issues;
  const where = v.getDotPath(first) ?? "the answer";
  return {
    why: `GitHub's answer isn't what its GraphQL API sends for the query (${where}: ${first.message})`,
    mightPass: false,
  };
}

function requestFor(body: string, token: string | undefined): RequestInit {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  return { method: "POST", headers, body, signal: AbortSignal.timeout(WAIT_MS.answer) };
}

type Query<Schema extends v.GenericSchema> = {
  text: string;
  variables: Record<string, unknown>;
  /** What the answer's `data` has to be. */
  schema: Schema;
};

async function tryOnce<Schema extends v.GenericSchema>(
  { text, variables, schema }: Query<Schema>,
  options: AskOptions,
): Promise<v.InferOutput<Schema> | Failure> {
  const body = JSON.stringify({ query: text, variables });
  const response = await options
    .fetch(GRAPHQL_ADDRESS, requestFor(body, options.token))
    .catch((error: unknown) => unreachable("GitHub", error));
  if (!(response instanceof Response)) return response;
  if (!response.ok) return refusal(response);
  const answer = v.safeParse(AnswerSchema, await response.json().catch(() => undefined));
  if (!answer.success) return misshapen(answer.issues);
  if (answer.output.errors?.length) return errorsSaid(answer.output.errors, response);
  const data = v.safeParse(schema, answer.output.data);
  return data.success ? data.output : misshapen(data.issues);
}

/** The data GitHub answers `query` with, as its schema has it. Throws,
    saying why, if GitHub can't be reached, refuses, says the query went
    wrong, or sends anything but what the schema says. */
export const askGitHub = <Schema extends v.GenericSchema>(
  query: Query<Schema>,
  options: AskOptions,
): Promise<v.InferOutput<Schema>> =>
  withOneMoreTry(GRAPHQL_ADDRESS, () => tryOnce(query, options), options.retryAfterMs);
