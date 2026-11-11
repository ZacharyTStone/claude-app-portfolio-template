/* AskGuard: the day's (UTC) questions, the site's and each visitor's, and
   the visitors blocked. The site has one, and it handles one request at a
   time, so the counts are exact. client.ts says what it answers. */
import { isRecord } from "../../shared/guards.ts";
import { DELETE_BATCH, GUARD_KEYS, GUARD_PATH, GUARD_REPLY, type BlockQuery, type TakeQuery } from "../constants.ts";
import { positiveNumber } from "../lib/shape.ts";

type SiteCount = { day: string; used: number };
type VisitorCount = { day: string; asked: number };

const isSiteCount = (value: unknown, day: string): value is SiteCount =>
  isRecord(value) && value.day === day && typeof value.used === "number";
const isVisitorCount = (value: unknown, day: string): value is VisitorCount =>
  isRecord(value) && value.day === day && typeof value.asked === "number";
const holds = (until: unknown, now: number) => typeof until === "number" && until > now;

const countKey = (who: string) => `${GUARD_KEYS.count}${who}`;
const blockKey = (who: string) => `${GUARD_KEYS.block}${who}`;

const HOUR = 3_600_000;

const badRequest = () => new Response("bad request", { status: 400 });

export class AskGuard implements DurableObject {
  private readonly storage: DurableObjectStorage;

  constructor(ctx: DurableObjectState) {
    this.storage = ctx.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const query = (name: keyof TakeQuery | keyof BlockQuery) => url.searchParams.get(name);
    const who = query("who");
    if (!who) return badRequest();
    const now = Date.now();
    if (url.pathname === GUARD_PATH.block) {
      const hours = positiveNumber(query("hours"));
      if (hours === null) return badRequest();
      await this.storage.put(blockKey(who), now + hours * HOUR);
      return new Response(GUARD_REPLY.ok);
    }
    if (url.pathname === GUARD_PATH.take) {
      const limit = positiveNumber(query("limit"));
      const each = positiveNumber(query("each"));
      if (limit === null || each === null) return badRequest();
      return new Response(await this.take(who, limit, each, now));
    }
    return new Response("not found", { status: 404 });
  }

  private async take(who: string, limit: number, each: number, now: number): Promise<string> {
    const until = await this.storage.get(blockKey(who));
    if (holds(until, now)) return GUARD_REPLY.blocked;
    if (until !== undefined) await this.storage.delete(blockKey(who));
    const day = new Date(now).toISOString().slice(0, 10);
    const today = await this.storage.get(GUARD_KEYS.today);
    if (today !== undefined && !isSiteCount(today, day)) await this.forget(now);
    const used = isSiteCount(today, day) ? today.used : 0;
    if (used >= limit) return GUARD_REPLY.spent;
    const theirs = await this.storage.get(countKey(who));
    const asked = isVisitorCount(theirs, day) ? theirs.asked : 0;
    if (asked >= each) return GUARD_REPLY.limited;
    await this.storage.put(GUARD_KEYS.today, { day, used: used + 1 } satisfies SiteCount);
    await this.storage.put(countKey(who), { day, asked: asked + 1 } satisfies VisitorCount);
    return `${GUARD_REPLY.ok} ${each - asked - 1}`;
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
