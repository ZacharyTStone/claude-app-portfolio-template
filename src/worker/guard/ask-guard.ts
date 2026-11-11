/* AskGuard: the day's (UTC) questions, the site's and each visitor's, the
   Neurons the site's have cost, and the visitors blocked. The site has one,
   and it handles one request at a time, so the counts are exact. client.ts
   says what it answers. */
import { isRecord } from "../../shared/guards.ts";
import {
  DELETE_BATCH,
  GUARD_KEYS,
  GUARD_PATH,
  GUARD_REPLY,
  type BlockQuery,
  type SpendQuery,
  type TakeQuery,
} from "../constants.ts";
import { positiveNumber } from "../lib/shape.ts";

type SiteCount = { day: string; used: number; neurons?: number };
type VisitorCount = { day: string; asked: number };

const isSiteCount = (value: unknown, day: string): value is SiteCount =>
  isRecord(value) &&
  value.day === day &&
  typeof value.used === "number" &&
  (value.neurons === undefined || typeof value.neurons === "number");
const isVisitorCount = (value: unknown, day: string): value is VisitorCount =>
  isRecord(value) && value.day === day && typeof value.asked === "number";
const holds = (until: unknown, now: number) => typeof until === "number" && until > now;

const countKey = (who: string) => `${GUARD_KEYS.count}${who}`;
const blockKey = (who: string) => `${GUARD_KEYS.block}${who}`;

const HOUR = 3_600_000;

// The day (UTC) a moment is in: "2026-01-31".
const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

const badRequest = () => new Response("bad request", { status: 400 });

export class AskGuard implements DurableObject {
  private readonly storage: DurableObjectStorage;

  constructor(ctx: DurableObjectState) {
    this.storage = ctx.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const query = (name: keyof TakeQuery | keyof BlockQuery | keyof SpendQuery) => url.searchParams.get(name);
    const now = Date.now();
    if (url.pathname === GUARD_PATH.spend) {
      const amount = positiveNumber(query("neurons"));
      if (amount === null) return badRequest();
      await this.spend(amount, now);
      return new Response(GUARD_REPLY.ok);
    }
    const who = query("who");
    if (!who) return badRequest();
    if (url.pathname === GUARD_PATH.block) {
      const hours = positiveNumber(query("hours"));
      if (hours === null) return badRequest();
      await this.storage.put(blockKey(who), now + hours * HOUR);
      return new Response(GUARD_REPLY.ok);
    }
    if (url.pathname === GUARD_PATH.take) {
      const limit = positiveNumber(query("limit"));
      const each = positiveNumber(query("each"));
      // A request without a budget has none, as before there was one.
      const budget = query("budget") === null ? Infinity : positiveNumber(query("budget"));
      if (limit === null || each === null || budget === null) return badRequest();
      return new Response(await this.take(who, { limit, each, budget }, now));
    }
    return new Response("not found", { status: 404 });
  }

  private async take(
    who: string,
    { limit, each, budget }: { limit: number; each: number; budget: number },
    now: number,
  ): Promise<string> {
    const until = await this.storage.get(blockKey(who));
    if (holds(until, now)) return GUARD_REPLY.blocked;
    if (until !== undefined) await this.storage.delete(blockKey(who));
    const day = dayOf(now);
    const today = await this.storage.get(GUARD_KEYS.today);
    if (today !== undefined && !isSiteCount(today, day)) await this.forget(now);
    const used = isSiteCount(today, day) ? today.used : 0;
    const neurons = isSiteCount(today, day) ? (today.neurons ?? 0) : 0;
    // The budget is checked before a question and counted after it, so the
    // questions on their way when it's reached take the day a little past.
    if (used >= limit || neurons >= budget) return GUARD_REPLY.spent;
    const theirs = await this.storage.get(countKey(who));
    const asked = isVisitorCount(theirs, day) ? theirs.asked : 0;
    if (asked >= each) return GUARD_REPLY.limited;
    await this.storage.put(GUARD_KEYS.today, { day, used: used + 1, neurons } satisfies SiteCount);
    await this.storage.put(countKey(who), { day, asked: asked + 1 } satisfies VisitorCount);
    return `${GUARD_REPLY.ok} ${each - asked - 1}`;
  }

  // Adds a question's cost to the day it was asked on. One asked just before
  // midnight and counted just after belongs to neither day, and is dropped.
  private async spend(amount: number, now: number): Promise<void> {
    const today = await this.storage.get(GUARD_KEYS.today);
    if (!isSiteCount(today, dayOf(now))) return;
    await this.storage.put(GUARD_KEYS.today, {
      ...today,
      neurons: (today.neurons ?? 0) + amount,
    } satisfies SiteCount);
  }

  // Every visitor's count (all from an earlier day), and the blocks that
  // have run out.
  private async forget(now: number): Promise<void> {
    const counts = [...(await this.storage.list({ prefix: GUARD_KEYS.count })).keys()];
    const blocks = [...(await this.storage.list({ prefix: GUARD_KEYS.block }))]
      .filter(([, until]) => !holds(until, now))
      .map(([key]) => key);
    const stale = [...counts, ...blocks];
    for (let i = 0; i < stale.length; i += DELETE_BATCH) await this.storage.delete(stale.slice(i, i + DELETE_BATCH));
  }
}
