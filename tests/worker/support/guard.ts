/* A stand-in for AskGuard's binding: it says what a test has it say, and
   keeps what it was asked. */
import { AskGuard } from "../../../src/worker/guard/ask-guard.ts";
import { ASK_GUARD_REPLY, readAsked, sayTaken, type Asked } from "../../../src/worker/guard/wire.ts";

/** What AskGuard says when it has taken a question and the visitor has
    `left` more today. */
export const okLeft = (left: number) => sayTaken({ state: "ok", questionsLeft: left });

export type GuardStub = {
  /** Each request it got, in order. */
  requests: URL[];
  /** How it was last reached: the id and the options it was got by. */
  last?: { id: unknown; options: unknown };
  idFromName(name: string): string;
  get(id: unknown, options: unknown): { fetch(url: string): Promise<Response> };
};

const isAsked = (asked: ReturnType<typeof readAsked>): asked is Asked => typeof asked !== "string";

/** What the guard was asked, in order, as AskGuard reads each request. */
export const askedOf = (guard: GuardStub): Asked[] => guard.requests.map(readAsked).filter(isAsked);

/** The first thing of one kind the guard was asked, if it was asked one. */
export const firstAsked = <Kind extends Asked["ask"]>(guard: GuardStub, kind: Kind) =>
  askedOf(guard).find((asked): asked is Extract<Asked, { ask: Kind }> => asked.ask === kind);

/** A guard that says `says` to a question it's asked to take (what okLeft()
    gives, a refusal's word, or anything else, to see how that's read), and
    "ok" to the rest. One that says "down" can't be reached at all. */
export function guardStub(says = okLeft(25), status = 200): GuardStub {
  const stub: GuardStub = {
    requests: [],
    idFromName: (name) => name,
    get: (id, options) => ({
      fetch: async (url) => {
        if (says === "down") throw new Error("Durable Object unavailable");
        stub.last = { id, options };
        stub.requests.push(new URL(url));
        const asked = readAsked(new URL(url));
        const isTake = isAsked(asked) && asked.ask === "take";
        return new Response(isTake ? says : ASK_GUARD_REPLY.ok, { status });
      },
    }),
  };
  return stub;
}

/** What AskGuard has stored, by key. */
export type Stored = Map<string, unknown>;

/** A stand-in for a Durable Object's storage over `stored`, which takes at
    most `maxKeysPerDelete` keys to a delete, as Cloudflare's does, and
    keeps the time its alarm is set for. */
export function storageOver(stored: Stored, maxKeysPerDelete = Infinity) {
  let alarmAt: number | null = null;
  return {
    getAlarm: async () => alarmAt,
    setAlarm: async (at: number) => void (alarmAt = at),
    get: async (key: string) => stored.get(key),
    put: async (key: string, value: unknown) => void stored.set(key, value),
    delete: async (keys: string | string[]) => {
      const all = [keys].flat();
      if (all.length > maxKeysPerDelete) throw new Error(`delete: ${all.length} keys`);
      all.forEach((key) => stored.delete(key));
    },
    list: async ({ prefix }: { prefix: string }) => new Map([...stored].filter(([key]) => key.startsWith(prefix))),
  };
}

/** The real AskGuard over `stored`, behind its binding's shape: for a test
    of what the Worker and its guard do together. It takes one request at a
    time, as a Durable Object does. */
export function realGuard(stored: Stored = new Map()): GuardStub {
  // Only the storage calls AskGuard makes are stood in for.
  const guard = new AskGuard({ storage: storageOver(stored) } as unknown as DurableObjectState);
  let lastRequest: Promise<unknown> = Promise.resolve();
  const stub: GuardStub = {
    requests: [],
    idFromName: (name) => name,
    get: (id, options) => ({
      fetch: (url) => {
        stub.last = { id, options };
        stub.requests.push(new URL(url));
        const response = lastRequest.then(() => guard.fetch(new Request(url, { method: "POST" })));
        lastRequest = response.catch(() => {});
        return response;
      },
    }),
  };
  return stub;
}
