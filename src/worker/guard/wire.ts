/* How /ask and its AskGuard talk: a POST to a path with what's asked in the
   query, and a word or two in reply. Nothing outside this folder reads or
   writes either. */
import { positiveNumber } from "../lib/shape.ts";

/** The name the site's one AskGuard is found by. */
export const ASK_GUARD_NAME = "ask";

/** The most that may be asked: of the whole site in a day and in an hour,
    by one visitor and by one network in a day; and the Neurons the day's
    questions may cost. */
export type DayLimits = {
  siteLimit: number;
  hourLimit: number;
  visitorLimit: number;
  networkLimit: number;
  neuronBudget: number;
};

/** Who's asking: the hash of their address, and of the network it's in. */
export type Asker = { visitorHash: string; networkHash: string };

/** What AskGuard is asked: to take one question from the day's allowances,
    to block a visitor, or to pay for a question it took with what that
    cost (nothing, for one that failed). */
export type Asked =
  | ({ ask: "take"; limits: DayLimits } & Asker)
  | { ask: "block"; visitorHash: string; hours: number }
  | { ask: "spend"; neurons: number };

export const ASK_GUARD_PATH = { take: "/take", block: "/block", spend: "/spend" } as const;

// Any host does: a Durable Object gets whatever it's sent.
const ORIGIN = "https://guard";

function queryOf(asked: Asked): Record<string, string> {
  switch (asked.ask) {
    case "take":
      return {
        limit: String(asked.limits.siteLimit),
        hourly: String(asked.limits.hourLimit),
        each: String(asked.limits.visitorLimit),
        shared: String(asked.limits.networkLimit),
        budget: String(asked.limits.neuronBudget),
        who: asked.visitorHash,
        net: asked.networkHash,
      };
    case "block":
      return { hours: String(asked.hours), who: asked.visitorHash };
    case "spend":
      return { neurons: String(asked.neurons) };
  }
}

export const urlAsking = (asked: Asked): string =>
  `${ORIGIN}${ASK_GUARD_PATH[asked.ask]}?${new URLSearchParams(queryOf(asked))}`;

function readLimits(query: URLSearchParams): DayLimits | undefined {
  const [siteLimit, hourLimit, visitorLimit, networkLimit] = ["limit", "hourly", "each", "shared"].map((name) =>
    positiveNumber(query.get(name)),
  );
  // A request without a budget has none, as before there was one.
  const neuronBudget = query.has("budget") ? positiveNumber(query.get("budget")) : Infinity;
  if (!siteLimit || !hourLimit || !visitorLimit || !networkLimit || neuronBudget === null) return undefined;
  return { siteLimit, hourLimit, visitorLimit, networkLimit, neuronBudget };
}

function readTake(query: URLSearchParams): Asked | undefined {
  const [visitorHash, networkHash] = [query.get("who"), query.get("net")];
  const limits = readLimits(query);
  return visitorHash && networkHash && limits ? { ask: "take", visitorHash, networkHash, limits } : undefined;
}

function readBlock(query: URLSearchParams): Asked | undefined {
  const visitorHash = query.get("who");
  const hours = positiveNumber(query.get("hours"));
  return visitorHash && hours !== null ? { ask: "block", visitorHash, hours } : undefined;
}

function readSpend(query: URLSearchParams): Asked | undefined {
  const said = query.get("neurons");
  const neurons = said === "0" ? 0 : positiveNumber(said);
  return neurons === null ? undefined : { ask: "spend", neurons };
}

const READERS: ReadonlyMap<string, (query: URLSearchParams) => Asked | undefined> = new Map([
  [ASK_GUARD_PATH.take, readTake],
  [ASK_GUARD_PATH.block, readBlock],
  [ASK_GUARD_PATH.spend, readSpend],
]);

/** What a request asks: "unknown" at a path AskGuard doesn't have, and
    "unreadable" with a query that doesn't say all its path needs. */
export function readAsked(url: URL): Asked | "unknown" | "unreadable" {
  const read = READERS.get(url.pathname);
  return read ? (read(url.searchParams) ?? "unreadable") : "unknown";
}

export const ASK_GUARD_REPLY = { ok: "ok", limited: "limited", spent: "spent", blocked: "blocked" } as const;

/** What came of taking a question:
    - ok: it can go to the model, and `questionsLeft` is how many more the
      visitor can ask today;
    - limited: they've asked all a visitor may today;
    - spent: the site's questions for today are used up, or the Neurons
      they may cost;
    - blocked: they asked something inappropriate earlier. */
export type Taken = { state: "ok"; questionsLeft: number } | { state: "limited" | "spent" | "blocked" };

/** That, or `down`: AskGuard isn't bound, can't be reached, or said
    something else. */
export type Gate = Taken | { state: "down" };

/** "ok 25" (the visitor has 25 questions left today), or the state alone. */
export const sayTaken = (taken: Taken): string =>
  taken.state === "ok" ? `${ASK_GUARD_REPLY.ok} ${taken.questionsLeft}` : taken.state;

export function readTaken(said: string): Gate {
  const [state, questionsLeft] = said.split(" ");
  if (state === ASK_GUARD_REPLY.ok) return { state, questionsLeft: Number(questionsLeft) };
  const isRefusal =
    state === ASK_GUARD_REPLY.limited || state === ASK_GUARD_REPLY.spent || state === ASK_GUARD_REPLY.blocked;
  return isRefusal ? { state } : { state: "down" };
}
