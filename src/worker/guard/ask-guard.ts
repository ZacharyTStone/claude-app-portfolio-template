/* AskGuard: the day's (UTC) questions, the site's, each visitor's and each
   network's, the site's this hour, the Neurons the site's have cost, and
   the visitors blocked. The site has one, and it handles one request at a
   time, so the counts are exact. */
import { chunk } from "es-toolkit";
import * as v from "valibot";
import { ASK_GUARD_REPLY, readAsked, sayTaken, type Asked, type DayLimits, type Taken } from "./wire.ts";

/** What it keeps. These keys are the deployed site's state, so they stay:
    - today: { day, used, neurons }, the site's questions on that day, and
      the Neurons they cost (not there before the first is counted);
    - hour: { hour, used }, the site's questions in that hour;
    - count + who: { day, asked }, one visitor's;
    - network + which: { day, asked }, one network's;
    - block + who: when their block runs out (ms since 1970). */
export const ASK_GUARD_KEYS = {
  today: "today",
  hour: "hour",
  count: "count:",
  network: "network:",
  block: "block:",
} as const;

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

/** Under `hour`: the site's questions in one hour ("2026-01-31T14"). */
const HourCountSchema = v.object({
  hour: v.string(),
  used: v.number(),
});
type HourCount = v.InferOutput<typeof HourCountSchema>;

/** Under `count:` and a visitor's hash, or `network:` and a network's: the
    questions asked from there on one day. */
const VisitorCountSchema = v.object({
  day: v.string(),
  asked: v.number(),
});
type VisitorCount = v.InferOutput<typeof VisitorCountSchema>;

// What's stored, if it's the site's count for `day`. A count for another
// day, or anything else, is none: the day starts from 0.
const siteCountOn = (day: string, stored: unknown): SiteCount | undefined =>
  v.is(SiteCountSchema, stored) && stored.day === day ? stored : undefined;

const hourCountIn = (hour: string, stored: unknown): HourCount | undefined =>
  v.is(HourCountSchema, stored) && stored.hour === hour ? stored : undefined;

const visitorCountOn = (day: string, stored: unknown): VisitorCount | undefined =>
  v.is(VisitorCountSchema, stored) && stored.day === day ? stored : undefined;

// A block is stored as the time it runs out.
const isStillBlocked = (blockedUntil: unknown, now: number) => typeof blockedUntil === "number" && blockedUntil > now;

const countKey = (visitorHash: string) => `${ASK_GUARD_KEYS.count}${visitorHash}`;
const networkKey = (networkHash: string) => `${ASK_GUARD_KEYS.network}${networkHash}`;
const blockKey = (visitorHash: string) => `${ASK_GUARD_KEYS.block}${visitorHash}`;

// "2026-01-31" and "2026-01-31T14", in UTC.
const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const hourOf = (now: number) => new Date(now).toISOString().slice(0, 13);

/** What has been asked so far: of the site today and this hour, by the
    visitor and from their network today; and what the site's have cost. */
type Counts = { used: number; neurons: number; usedThisHour: number; asked: number; networkAsked: number };

// The site's limits come first: a visitor is told they've asked all they
// may only while the site still takes questions.
function refusalAt(counts: Counts, limits: DayLimits): "spent" | "limited" | undefined {
  // The budget is checked before a question and counted after it, so the
  // questions on their way when it's reached take the day a little past.
  const isDaySpent = counts.used >= limits.siteLimit || counts.neurons >= limits.neuronBudget;
  if (isDaySpent || counts.usedThisHour >= limits.hourLimit) return "spent";
  const isLimited = counts.asked >= limits.visitorLimit || counts.networkAsked >= limits.networkLimit;
  return isLimited ? "limited" : undefined;
}

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
        return sayTaken(await this.takeQuestion(asked, now));
      case "block":
        await this.storage.put(blockKey(asked.visitorHash), now + asked.hours * MS_PER_HOUR);
        return ASK_GUARD_REPLY.ok;
      case "spend":
        await this.spendNeurons(asked.neurons, now);
        return ASK_GUARD_REPLY.ok;
    }
  }

  private async takeQuestion(take: Extract<Asked, { ask: "take" }>, now: number): Promise<Taken> {
    const { visitorHash, networkHash, limits } = take;
    if (await this.isBlocked(visitorHash, now)) return { state: "blocked" };
    const [day, hour] = [dayOf(now), hourOf(now)];
    const { used, neurons } = await this.siteCountFor(day, now);
    const usedThisHour = hourCountIn(hour, await this.storage.get(ASK_GUARD_KEYS.hour))?.used ?? 0;
    const asked = visitorCountOn(day, await this.storage.get(countKey(visitorHash)))?.asked ?? 0;
    const networkAsked = visitorCountOn(day, await this.storage.get(networkKey(networkHash)))?.asked ?? 0;
    const refusal = refusalAt({ used, neurons, usedThisHour, asked, networkAsked }, limits);
    if (refusal) return { state: refusal };
    await this.storage.put(ASK_GUARD_KEYS.today, { day, used: used + 1, neurons } satisfies SiteCount);
    await this.storage.put(ASK_GUARD_KEYS.hour, { hour, used: usedThisHour + 1 } satisfies HourCount);
    await this.storage.put(countKey(visitorHash), { day, asked: asked + 1 } satisfies VisitorCount);
    await this.storage.put(networkKey(networkHash), { day, asked: networkAsked + 1 } satisfies VisitorCount);
    const left = Math.min(limits.visitorLimit - asked, limits.networkLimit - networkAsked) - 1;
    return { state: "ok", questionsLeft: left };
  }

  // A block that has run out is deleted.
  private async isBlocked(visitorHash: string, now: number): Promise<boolean> {
    const blockedUntil = await this.storage.get(blockKey(visitorHash));
    if (isStillBlocked(blockedUntil, now)) return true;
    if (blockedUntil !== undefined) await this.storage.delete(blockKey(visitorHash));
    return false;
  }

  // When what's stored is an earlier day's, that day is over: its counts
  // are deleted, and this one starts from nothing.
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

  // Every visitor's count and every network's is an earlier day's by now.
  private async deleteWhatHasRunOut(now: number): Promise<void> {
    const visitorCounts = [
      ...(await this.storage.list({ prefix: ASK_GUARD_KEYS.count })).keys(),
      ...(await this.storage.list({ prefix: ASK_GUARD_KEYS.network })).keys(),
    ];
    const expiredBlocks = [...(await this.storage.list({ prefix: ASK_GUARD_KEYS.block }))]
      .filter(([, blockedUntil]) => !isStillBlocked(blockedUntil, now))
      .map(([key]) => key);
    for (const keys of chunk([...visitorCounts, ...expiredBlocks], MAX_KEYS_PER_DELETE)) {
      await this.storage.delete(keys);
    }
  }
}
