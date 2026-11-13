/* AskGuard: the day's (UTC) questions, the site's and each visitor's, the
   Neurons the site's have cost, and the visitors blocked. The site has one,
   and it handles one request at a time, so the counts are exact. */
import { chunk } from "es-toolkit";
import * as v from "valibot";
import { ASK_GUARD_REPLY, readAsked, sayTaken, type Asked, type DayLimits, type Taken } from "./wire.ts";

/** What it keeps. These keys are the deployed site's state, so they stay:
    - today: { day, used, neurons }, the site's questions on that day, and
      the Neurons they cost (not there before the first is counted);
    - count + who: { day, asked }, one visitor's;
    - block + who: when their block runs out (ms since 1970). */
export const ASK_GUARD_KEYS = { today: "today", count: "count:", block: "block:" } as const;

/** storage.delete() takes at most this many keys at once. */
export const MAX_KEYS_PER_DELETE = 128;

const MS_PER_HOUR = 3_600_000;

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

/** The Durable Object that keeps the day's counts and the blocks. */
export class AskGuard implements DurableObject {
  private readonly storage: DurableObjectStorage;

  constructor(ctx: DurableObjectState) {
    this.storage = ctx.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const asked = readAsked(new URL(request.url));
    if (asked === "unknown") return new Response("not found", { status: 404 });
    if (asked === "unreadable") return new Response("bad request", { status: 400 });
    return new Response(await this.answerTo(asked, Date.now()));
  }

  private async answerTo(asked: Asked, now: number): Promise<string> {
    switch (asked.ask) {
      case "take":
        return sayTaken(await this.takeQuestion(asked.visitorHash, asked.limits, now));
      case "block":
        await this.storage.put(blockKey(asked.visitorHash), now + asked.hours * MS_PER_HOUR);
        return ASK_GUARD_REPLY.ok;
      case "spend":
        await this.spendNeurons(asked.neurons, now);
        return ASK_GUARD_REPLY.ok;
    }
  }

  // Counts one question against the site's day and the visitor's, unless
  // the visitor is blocked or either allowance is used up.
  private async takeQuestion(visitorHash: string, limits: DayLimits, now: number): Promise<Taken> {
    if (await this.isBlocked(visitorHash, now)) return { state: "blocked" };
    const day = dayOf(now);
    const { used, neurons } = await this.siteCountFor(day, now);
    // The budget is checked before a question and counted after it, so the
    // questions on their way when it's reached take the day a little past.
    if (used >= limits.siteLimit || neurons >= limits.neuronBudget) return { state: "spent" };
    const asked = visitorCountOn(day, await this.storage.get(countKey(visitorHash)))?.asked ?? 0;
    if (asked >= limits.visitorLimit) return { state: "limited" };
    await this.storage.put(ASK_GUARD_KEYS.today, { day, used: used + 1, neurons } satisfies SiteCount);
    await this.storage.put(countKey(visitorHash), { day, asked: asked + 1 } satisfies VisitorCount);
    return { state: "ok", questionsLeft: limits.visitorLimit - asked - 1 };
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
