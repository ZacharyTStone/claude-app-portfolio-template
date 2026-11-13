/* A stand-in for AskGuard's binding: it says what a test has it say, and
   keeps what it was asked. */
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
