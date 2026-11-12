/* AskGuard: the day's (UTC) questions, the site's and each visitor's, the
   Neurons the site's have cost, and the visitors blocked. The site has one,
   and it handles one request at a time, so the counts are exact. client.ts
   says what it answers. */
import { chunk } from "es-toolkit";
import * as v from "valibot";
import {
  ASK_GUARD_KEYS,
  ASK_GUARD_PATH,
  ASK_GUARD_REPLY,
  MAX_KEYS_PER_DELETE,
  MS_PER_HOUR,
  type BlockQuery,
  type SpendQuery,
  type TakeQuery,
} from "../constants.ts";
import { positiveNumber } from "../lib/shape.ts";

// ---- What it keeps (ASK_GUARD_KEYS has the keys) -----------------------------------

/** Under `today`: the site's questions on one day. */
const SiteCountSchema = v.object({
  /** The day (UTC) the count is for: "2026-01-31". */
  day: v.string(),
  /** How many questions went to the model that day. */
  used: v.number(),
  /** What they cost, in Neurons. A count stored before costs were counted
      has none, and reads as 0. */
  neurons: v.optional(v.number()),
});
type SiteCount = v.InferOutput<typeof SiteCountSchema>;

/** Under `count:` and a visitor's hash: that visitor's questions on one day. */
const VisitorCountSchema = v.object({
  /** The day (UTC) the count is for. */
  day: v.string(),
  /** How many questions they asked that day. */
  asked: v.number(),
});
type VisitorCount = v.InferOutput<typeof VisitorCountSchema>;

// What's stored, if it's the site's count for `day`. A count for another
// day, or anything else, is none: the day starts from 0.
const siteCountOn = (day: string, stored: unknown): SiteCount | undefined =>
  v.is(SiteCountSchema, stored) && stored.day === day ? stored : undefined;

// The same for one visitor's count.
const visitorCountOn = (day: string, stored: unknown): VisitorCount | undefined =>
  v.is(VisitorCountSchema, stored) && stored.day === day ? stored : undefined;

// Under `block:` and a visitor's hash is when their block runs out (ms
// since 1970): whether what's stored is a time still to come.
const isStillBlocked = (blockedUntil: unknown, now: number) => typeof blockedUntil === "number" && blockedUntil > now;

const countKey = (visitorHash: string) => `${ASK_GUARD_KEYS.count}${visitorHash}`;
const blockKey = (visitorHash: string) => `${ASK_GUARD_KEYS.block}${visitorHash}`;

// The day (UTC) a moment is in: "2026-01-31".
const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

// ---- What it's asked ---------------------------------------------------------------

/** The day's allowances, as a /take request gives them. */
type DayLimits = {
  /** The most questions the whole site may be asked today. */
  siteLimit: number;
  /** The most one visitor may ask today. */
  visitorLimit: number;
  /** The most Neurons the day's questions may cost. */
  neuronBudget: number;
};

type QueryName = keyof TakeQuery | keyof BlockQuery | keyof SpendQuery;

const ok = () => new Response(ASK_GUARD_REPLY.ok);
const badRequest = () => new Response("bad request", { status: 400 });
const notFound = () => new Response("not found", { status: 404 });

/** The Durable Object that keeps the day's counts and the blocks. */
export class AskGuard implements DurableObject {
  private readonly storage: DurableObjectStorage;

  constructor(ctx: DurableObjectState) {
    this.storage = ctx.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const query = (name: QueryName) => url.searchParams.get(name);
    const now = Date.now();
    if (url.pathname === ASK_GUARD_PATH.spend) {
      const neurons = positiveNumber(query("neurons"));
      if (neurons === null) return badRequest();
      await this.spendNeurons(neurons, now);
      return ok();
    }
    const visitorHash = query("who");
    if (!visitorHash) return badRequest();
    if (url.pathname === ASK_GUARD_PATH.block) {
      const hours = positiveNumber(query("hours"));
      if (hours === null) return badRequest();
      await this.storage.put(blockKey(visitorHash), now + hours * MS_PER_HOUR);
      return ok();
    }
    if (url.pathname === ASK_GUARD_PATH.take) {
      const siteLimit = positiveNumber(query("limit"));
      const visitorLimit = positiveNumber(query("each"));
      // A request without a budget has none, as before there was one.
      const neuronBudget = query("budget") === null ? Infinity : positiveNumber(query("budget"));
      if (siteLimit === null || visitorLimit === null || neuronBudget === null) return badRequest();
      return new Response(await this.takeQuestion(visitorHash, { siteLimit, visitorLimit, neuronBudget }, now));
    }
    return notFound();
  }

  // Counts one question against the site's day and the visitor's, unless
  // the visitor is blocked or either allowance is used up. What it returns
  // is the reply to /take: "ok" and how many the visitor has left, or
  // which of those stopped it.
  private async takeQuestion(
    visitorHash: string,
    { siteLimit, visitorLimit, neuronBudget }: DayLimits,
    now: number,
  ): Promise<string> {
    if (await this.isBlocked(visitorHash, now)) return ASK_GUARD_REPLY.blocked;
    const day = dayOf(now);
    const { used, neurons } = await this.siteCountFor(day, now);
    // The budget is checked before a question and counted after it, so the
    // questions on their way when it's reached take the day a little past.
    if (used >= siteLimit || neurons >= neuronBudget) return ASK_GUARD_REPLY.spent;
    const asked = visitorCountOn(day, await this.storage.get(countKey(visitorHash)))?.asked ?? 0;
    if (asked >= visitorLimit) return ASK_GUARD_REPLY.limited;
    await this.storage.put(ASK_GUARD_KEYS.today, { day, used: used + 1, neurons } satisfies SiteCount);
    await this.storage.put(countKey(visitorHash), { day, asked: asked + 1 } satisfies VisitorCount);
    return `${ASK_GUARD_REPLY.ok} ${visitorLimit - asked - 1}`;
  }

  // Whether the visitor's block still holds. One that has run out is
  // deleted.
  private async isBlocked(visitorHash: string, now: number): Promise<boolean> {
    const blockedUntil = await this.storage.get(blockKey(visitorHash));
    if (isStillBlocked(blockedUntil, now)) return true;
    if (blockedUntil !== undefined) await this.storage.delete(blockKey(visitorHash));
    return false;
  }

  // The site's questions on `day` so far, and what they've cost. When
  // what's stored is an earlier day's, that day is over: its counts are
  // deleted, and this one starts from nothing.
  private async siteCountFor(day: string, now: number): Promise<Required<SiteCount>> {
    const stored = await this.storage.get(ASK_GUARD_KEYS.today);
    const count = siteCountOn(day, stored);
    if (count) return { day, used: count.used, neurons: count.neurons ?? 0 };
    if (stored !== undefined) await this.deleteWhatHasRunOut(now);
    return { day, used: 0, neurons: 0 };
  }

  // Adds a question's cost to the day it was asked on. One asked just before
  // midnight and counted just after belongs to neither day, and is dropped.
  private async spendNeurons(neurons: number, now: number): Promise<void> {
    const today = siteCountOn(dayOf(now), await this.storage.get(ASK_GUARD_KEYS.today));
    if (!today) return;
    await this.storage.put(ASK_GUARD_KEYS.today, {
      ...today,
      neurons: (today.neurons ?? 0) + neurons,
    } satisfies SiteCount);
  }

  // Deletes every visitor's count (all from an earlier day), and the blocks
  // that have run out.
  private async deleteWhatHasRunOut(now: number): Promise<void> {
    const visitorCounts = [...(await this.storage.list({ prefix: ASK_GUARD_KEYS.count })).keys()];
    const expiredBlocks = [...(await this.storage.list({ prefix: ASK_GUARD_KEYS.block }))]
      .filter(([, blockedUntil]) => !isStillBlocked(blockedUntil, now))
      .map(([key]) => key);
    for (const keys of chunk([...visitorCounts, ...expiredBlocks], MAX_KEYS_PER_DELETE)) {
      await this.storage.delete(keys);
    }
  }
}
