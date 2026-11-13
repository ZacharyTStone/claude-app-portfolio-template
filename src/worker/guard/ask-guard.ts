/* AskGuard: the day's (UTC) questions, the site's, each visitor's and each
   network's, the site's this hour, the Neurons the site's have cost and
   may yet, and the visitors blocked. The site has one, and it handles one
   request at a time, so the counts are exact. What it keeps of a visitor
   is under a hash of their address that's another one tomorrow, and is
   deleted when the day ends. */
import { chunk } from "es-toolkit";
import * as v from "valibot";
import { utcDay } from "../lib/time.ts";
import { ASK_GUARD_REPLY, readAsked, sayTaken, type Asked, type DayLimits, type Taken } from "./wire.ts";

/** What it keeps. These keys are the deployed site's state, so they stay:
    - today: { day, used, neurons, unpaid }, the site's questions on that
      day, the Neurons they cost, and how many of them aren't paid for yet
      (neither of the last two is there before it's first counted);
    - hour: { hour, used }, the site's questions in that hour;
    - dearest: the most Neurons one question has cost, on any day;
    - count + who: { day, asked }, one visitor's;
    - network + which: { day, asked }, one network's;
    - block + who: when their block runs out (ms since 1970).
    The last three are deleted when the day ends. */
export const ASK_GUARD_KEYS = {
  today: "today",
  hour: "hour",
  dearest: "dearest",
  count: "count:",
  network: "network:",
  block: "block:",
} as const;

/** storage.delete() takes at most this many keys at once. */
export const MAX_KEYS_PER_DELETE = 128;

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Under `today`: the site's questions on one day. */
const SiteCountSchema = v.object({
  /** The day (UTC) the count is for: "2026-01-31". */
  day: v.string(),
  /** How many questions went to the model that day. */
  used: v.number(),
  /** What those paid for so far cost, in Neurons. A count stored before
      costs were counted has none. */
  neurons: v.optional(v.number(), 0),
  /** How many of them aren't paid for yet: they're still being answered. */
  unpaid: v.optional(v.number(), 0),
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
function siteCountOn(day: string, stored: unknown): SiteCount | undefined {
  const count = v.safeParse(SiteCountSchema, stored);
  return count.success && count.output.day === day ? count.output : undefined;
}

const hourCountIn = (hour: string, stored: unknown): HourCount | undefined =>
  v.is(HourCountSchema, stored) && stored.hour === hour ? stored : undefined;

// A day none has been asked on yet.
const startOf = (day: string): SiteCount => ({ day, used: 0, neurons: 0, unpaid: 0 });

const visitorCountOn = (day: string, stored: unknown): VisitorCount | undefined =>
  v.is(VisitorCountSchema, stored) && stored.day === day ? stored : undefined;

// A block is stored as the time it runs out.
const isStillBlocked = (blockedUntil: unknown, now: number) => typeof blockedUntil === "number" && blockedUntil > now;

const countKey = (visitorHash: string) => `${ASK_GUARD_KEYS.count}${visitorHash}`;
const networkKey = (networkHash: string) => `${ASK_GUARD_KEYS.network}${networkHash}`;
const blockKey = (visitorHash: string) => `${ASK_GUARD_KEYS.block}${visitorHash}`;

// "2026-01-31T14", in UTC.
const hourOf = (now: number) => new Date(now).toISOString().slice(0, 13);

// The midnight (UTC) that ends the day `now` is in.
const endOfDay = (now: number) => (Math.floor(now / MS_PER_DAY) + 1) * MS_PER_DAY;

/** What has been asked so far: of the site today and this hour, by the
    visitor and from their network today; and the most a question has
    cost, once one has been paid for. */
type Counts = { site: SiteCount; usedThisHour: number; asked: number; networkAsked: number; dearest?: number };

// A question is paid for only once it's answered, so each one that isn't
// yet is counted at the most one has cost: a burst takes the day past its
// budget by little more than one question's cost. Before any has been paid
// for there's nothing to count them at, and they're taken one at a time.
function isBudgetSpent({ site, dearest }: Counts, neuronBudget: number): boolean {
  if (site.neurons >= neuronBudget) return true;
  const roomFor = dearest === undefined ? 1 : (neuronBudget - site.neurons) / dearest;
  return site.unpaid >= roomFor;
}

// The site's limits come first: a visitor is told they've asked all they
// may only while the site still takes questions.
function refusalAt(counts: Counts, limits: DayLimits): "spent" | "limited" | undefined {
  const isDaySpent = counts.site.used >= limits.siteLimit || isBudgetSpent(counts, limits.neuronBudget);
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
        await this.forgetVisitorsAtEndOf(now);
        return ASK_GUARD_REPLY.ok;
      case "spend":
        await this.spendNeurons(asked.neurons, now);
        return ASK_GUARD_REPLY.ok;
    }
  }

  private async takeQuestion(take: Extract<Asked, { ask: "take" }>, now: number): Promise<Taken> {
    const { visitorHash, networkHash, limits } = take;
    if (isStillBlocked(await this.storage.get(blockKey(visitorHash)), now)) return { state: "blocked" };
    const [day, hour] = [utcDay(now), hourOf(now)];
    const site = siteCountOn(day, await this.storage.get(ASK_GUARD_KEYS.today)) ?? startOf(day);
    const usedThisHour = hourCountIn(hour, await this.storage.get(ASK_GUARD_KEYS.hour))?.used ?? 0;
    const asked = visitorCountOn(day, await this.storage.get(countKey(visitorHash)))?.asked ?? 0;
    const networkAsked = visitorCountOn(day, await this.storage.get(networkKey(networkHash)))?.asked ?? 0;
    const dearest = await this.dearestQuestion();
    const refusal = refusalAt({ site, usedThisHour, asked, networkAsked, dearest }, limits);
    if (refusal) return { state: refusal };
    const taken: SiteCount = { ...site, used: site.used + 1, unpaid: site.unpaid + 1 };
    await this.storage.put(ASK_GUARD_KEYS.today, taken);
    await this.storage.put(ASK_GUARD_KEYS.hour, { hour, used: usedThisHour + 1 } satisfies HourCount);
    await this.storage.put(countKey(visitorHash), { day, asked: asked + 1 } satisfies VisitorCount);
    await this.storage.put(networkKey(networkHash), { day, asked: networkAsked + 1 } satisfies VisitorCount);
    await this.forgetVisitorsAtEndOf(now);
    const left = Math.min(limits.visitorLimit - asked, limits.networkLimit - networkAsked) - 1;
    return { state: "ok", questionsLeft: left };
  }

  // Whenever something is kept under a visitor's hash, an alarm is set for
  // the day's end, if none is: nothing of a visitor's waits for the next
  // question to be deleted.
  private async forgetVisitorsAtEndOf(now: number): Promise<void> {
    if ((await this.storage.getAlarm()) === null) await this.storage.setAlarm(endOfDay(now));
  }

  /** At the day's end: everything kept under a visitor's hash or a
      network's is deleted, blocks too. Tomorrow's hashes are other ones,
      so none of it could be found again. */
  async alarm(): Promise<void> {
    const keys: string[] = [];
    for (const prefix of [ASK_GUARD_KEYS.count, ASK_GUARD_KEYS.network, ASK_GUARD_KEYS.block]) {
      keys.push(...(await this.storage.list({ prefix })).keys());
    }
    for (const some of chunk(keys, MAX_KEYS_PER_DELETE)) await this.storage.delete(some);
  }

  private async dearestQuestion(): Promise<number | undefined> {
    const dearest = await this.storage.get(ASK_GUARD_KEYS.dearest);
    return typeof dearest === "number" ? dearest : undefined;
  }

  // Pays for a question on the day it was asked: its cost is added to the
  // day's, and it's no longer counted as unpaid. One asked just before
  // midnight and paid for just after belongs to neither day, and is dropped.
  private async spendNeurons(neurons: number, now: number): Promise<void> {
    const today = siteCountOn(utcDay(now), await this.storage.get(ASK_GUARD_KEYS.today));
    if (!today) return;
    const paid: SiteCount = { ...today, neurons: today.neurons + neurons, unpaid: Math.max(today.unpaid - 1, 0) };
    await this.storage.put(ASK_GUARD_KEYS.today, paid);
    const dearest = (await this.dearestQuestion()) ?? 0;
    if (neurons > dearest) await this.storage.put(ASK_GUARD_KEYS.dearest, neurons);
  }
}
