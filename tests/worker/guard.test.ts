/* AskGuard (src/worker/guard/): the Durable Object that counts the day's
   questions, the site's and each visitor's, and what the site's cost, and
   keeps the blocks; what /ask says to it; and how /ask reads what it says
   back. Past any limit, or with the guard down, the model isn't asked. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { INAPPROPRIATE } from "../../src/worker/ask/prompts/pick.ts";
import { ASK_GUARD_KEYS, AskGuard, MAX_KEYS_PER_DELETE } from "../../src/worker/guard/ask-guard.ts";
import {
  ASK_GUARD_NAME,
  ASK_GUARD_PATH,
  ASK_GUARD_REPLY,
  readAsked,
  readTaken,
  sayTaken,
  urlAsking,
  type Asked,
  type Taken,
} from "../../src/worker/guard/wire.ts";
import { SETTINGS } from "../../src/worker/settings.ts";
import { firstAsked, guardStub, okLeft } from "./support/guard.ts";
import { models, toolCall } from "./support/models.ts";
import { stubs } from "./support/worker.ts";

test("what /ask asks of the guard reads back as it was asked", () => {
  const asked: Asked[] = [
    { ask: "take", visitorHash: "abc", limits: { siteLimit: 200, visitorLimit: 30, neuronBudget: 9000 } },
    { ask: "block", visitorHash: "abc", hours: 24 },
    { ask: "spend", neurons: 21.25 },
  ];
  assert.deepEqual(
    asked.map((one) => readAsked(new URL(urlAsking(one)))),
    asked,
  );
});

test("what the guard says of a question it took reads back as it was said", () => {
  const taken: Taken[] = [
    { state: "ok", questionsLeft: 25 },
    { state: "limited" },
    { state: "spent" },
    { state: "blocked" },
  ];
  assert.deepEqual(
    taken.map((one) => readTaken(sayTaken(one))),
    taken,
  );
});

test("the guard is asked with the day's limits (the site's, a visitor's, the Neurons), as set or by default", async () => {
  const limitsAsked = async (vars = {}) => {
    const { askJson, guard } = stubs({ vars });
    await askJson("who?");
    return firstAsked(guard, "take")?.limits;
  };
  const defaults = {
    siteLimit: SETTINGS.dailyLimit.default,
    visitorLimit: SETTINGS.visitorLimit.default,
    neuronBudget: SETTINGS.neuronBudget.default,
  };
  assert.deepEqual(await limitsAsked(), defaults);
  assert.deepEqual(await limitsAsked({ ASK_DAILY_LIMIT: "7", ASK_VISITOR_LIMIT: "5", ASK_DAILY_NEURONS: "1200" }), {
    siteLimit: 7,
    visitorLimit: 5,
    neuronBudget: 1200,
  });
  for (const bad of ["0", "-1", "Infinity", "lots"]) {
    const set = { ASK_DAILY_LIMIT: bad, ASK_VISITOR_LIMIT: bad, ASK_DAILY_NEURONS: bad };
    assert.deepEqual(await limitsAsked(set), defaults);
  }
});

test("the site's daily allowance spent, or its counter down or unreadable: no model call", async () => {
  for (const guard of [
    guardStub(ASK_GUARD_REPLY.spent),
    guardStub("down"),
    guardStub(okLeft(25), 500),
    guardStub("maybe 3"),
    guardStub(""),
  ]) {
    const { askJson, calls } = stubs({ guard });
    assert.deepEqual(await askJson("who?"), { id: null, why: "budget" });
    assert.equal(calls.length, 0);
  }
});

test("the guard is one object, placed where ASK_GUARD_LOCATION says, and anything else is the default", async () => {
  for (const [location, expected] of [
    [undefined, SETTINGS.guardLocation.default],
    ["weur", "weur"],
    ["apac", "apac"],
    ["mars", SETTINGS.guardLocation.default],
    ["", SETTINGS.guardLocation.default],
  ]) {
    const { askJson, guard } = stubs({ run: models(toolCall(INAPPROPRIATE)), vars: { ASK_GUARD_LOCATION: location } });
    await askJson("rude");
    assert.deepEqual(guard.last, { id: ASK_GUARD_NAME, options: { locationHint: expected } }, `${location}`);
    assert.ok(firstAsked(guard, "block"), "the block goes to the same guard");
  }
});

type Stored = Map<string, unknown>;

// An AskGuard over `stored`, whose storage takes at most MAX_KEYS_PER_DELETE keys
// to a delete, as Cloudflare's does.
function guardOver(stored: Stored) {
  const storage = {
    get: async (key: string) => stored.get(key),
    put: async (key: string, value: unknown) => void stored.set(key, value),
    delete: async (keys: string | string[]) => {
      const all = [keys].flat();
      if (all.length > MAX_KEYS_PER_DELETE) throw new Error(`delete: ${all.length} keys`);
      all.forEach((key) => stored.delete(key));
    },
    list: async ({ prefix }: { prefix: string }) => new Map([...stored].filter(([key]) => key.startsWith(prefix))),
  };
  // Only the storage calls AskGuard makes are stood in for.
  const guard = new AskGuard({ storage } as unknown as DurableObjectState);
  return async (path: string, query: Record<string, string | number>) => {
    const search = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
    const response = await guard.fetch(new Request(`https://guard${path}?${search}`, { method: "POST" }));
    return response.ok ? response.text() : response.status;
  };
}

const used = (stored: Stored) => (stored.get(ASK_GUARD_KEYS.today) as { used: number } | undefined)?.used;
const spent = (stored: Stored) => (stored.get(ASK_GUARD_KEYS.today) as { neurons?: number } | undefined)?.neurons;

/** A guard over `stored`, and a way to have it take a question from `who`. */
function taking(stored: Stored = new Map()) {
  const call = guardOver(stored);
  const take = (who: string, limit: number, each: number) =>
    call(ASK_GUARD_PATH.take, { limit, each, budget: 9000, who });
  return { stored, call, take };
}

test("the guard counts the site's day across visitors", async () => {
  const { take } = taking();
  const replies = [];
  for (const who of ["a", "b", "c", "d"]) replies.push(await take(who, 3, 30));
  assert.deepEqual(replies, [okLeft(29), okLeft(29), okLeft(29), ASK_GUARD_REPLY.spent]);
});

test("it counts each visitor's day while others carry on, and one turned away spends nothing of the site's", async () => {
  const { stored, take } = taking();
  const theirs = [];
  for (let i = 0; i < 3; i++) theirs.push(await take("e", 99, 2));
  assert.deepEqual(theirs, [okLeft(1), okLeft(0), ASK_GUARD_REPLY.limited]);
  assert.equal(used(stored), 2);
  assert.equal(await take("f", 99, 2), okLeft(1));
});

test("a block holds until it runs out, and a blocked visitor spends nothing", async () => {
  const { stored, call, take } = taking();
  await take("f", 99, 30);
  await call(ASK_GUARD_PATH.block, { hours: 24, who: "g" });
  assert.equal(await take("g", 99, 30), ASK_GUARD_REPLY.blocked);
  assert.equal(used(stored), 1);
  stored.set(`${ASK_GUARD_KEYS.block}g`, Date.now() - 1);
  assert.equal(await take("g", 99, 30), okLeft(29));
});

test("a new day forgets every visitor's count and the blocks run out, however many, and keeps the rest", async () => {
  const stored: Stored = new Map([[ASK_GUARD_KEYS.today, { day: "2000-01-01", used: 3 }]]);
  for (let i = 0; i < MAX_KEYS_PER_DELETE * 2 + 1; i++) {
    stored.set(`${ASK_GUARD_KEYS.count}${i}`, { day: "2000-01-01", asked: 1 });
    stored.set(`${ASK_GUARD_KEYS.block}old${i}`, Date.now() - 1);
  }
  stored.set(`${ASK_GUARD_KEYS.block}still`, Date.now() + 60_000);
  assert.equal(await guardOver(stored)(ASK_GUARD_PATH.take, { limit: 3, each: 30, who: "a" }), okLeft(29));
  assert.deepEqual(
    [...stored.keys()].sort(),
    [`${ASK_GUARD_KEYS.block}still`, `${ASK_GUARD_KEYS.count}a`, ASK_GUARD_KEYS.today].sort(),
  );
});

/** A guard over `stored`, and a way to have it take a question against a
    budget of Neurons. */
function budgeting(stored: Stored = new Map()) {
  const call = guardOver(stored);
  const take = (who: string, budget: number | string = 100) =>
    call(ASK_GUARD_PATH.take, { limit: 99, each: 30, budget, who });
  return { stored, call, take };
}

/** A day on which two questions have cost all of a budget of 100 Neurons. */
async function aDayAtItsBudget() {
  const day = budgeting();
  await day.take("a");
  await day.call(ASK_GUARD_PATH.spend, { neurons: 60.5 });
  await day.take("b");
  await day.call(ASK_GUARD_PATH.spend, { neurons: 39.5 });
  return day;
}

test("a cost that comes in before the day's first question has nothing to be added to", async () => {
  const { stored, call } = budgeting();
  assert.equal(await call(ASK_GUARD_PATH.spend, { neurons: 5 }), ASK_GUARD_REPLY.ok);
  assert.equal(spent(stored), undefined);
});

test("the guard adds up what the day's questions cost, and taking a question keeps what's been spent", async () => {
  const { stored, call, take } = budgeting();
  assert.equal(await take("a"), okLeft(29));
  assert.equal(await call(ASK_GUARD_PATH.spend, { neurons: 60.5 }), ASK_GUARD_REPLY.ok);
  assert.equal(await take("b"), okLeft(29));
  assert.equal(spent(stored), 60.5);
  await call(ASK_GUARD_PATH.spend, { neurons: 39.5 });
  assert.equal(spent(stored), 100);
});

test("at the budget it takes no more, whoever asks, and nothing of theirs is counted", async () => {
  const { stored, take } = await aDayAtItsBudget();
  assert.equal(await take("c"), ASK_GUARD_REPLY.spent);
  assert.equal(used(stored), 2);
  assert.equal(stored.has(`${ASK_GUARD_KEYS.count}c`), false);
});

test("a larger budget lets the day go on, and a request with none has no limit", async () => {
  const { call, take } = await aDayAtItsBudget();
  assert.equal(await take("c", 101), okLeft(29));
  assert.equal(await call(ASK_GUARD_PATH.take, { limit: 99, each: 30, who: "d" }), okLeft(29));
});

test("the next day starts from nothing, and a cost that comes in for the day before is dropped", async () => {
  const { stored, call, take } = budgeting();
  stored.set(ASK_GUARD_KEYS.today, { day: "2000-01-01", used: 50, neurons: 100 });
  await call(ASK_GUARD_PATH.spend, { neurons: 7 });
  assert.deepEqual(stored.get(ASK_GUARD_KEYS.today), { day: "2000-01-01", used: 50, neurons: 100 });
  assert.equal(await take("e"), okLeft(29));
  assert.equal(spent(stored), 0);
});

test("a day's count from before the guard counted Neurons is read as none spent", async () => {
  const stored: Stored = new Map();
  const call = guardOver(stored);
  assert.equal(await call(ASK_GUARD_PATH.take, { limit: 99, each: 30, budget: 10, who: "a" }), okLeft(29));
  const today = stored.get(ASK_GUARD_KEYS.today) as { day: string; used: number };
  stored.set(ASK_GUARD_KEYS.today, { day: today.day, used: today.used });
  assert.equal(await call(ASK_GUARD_PATH.take, { limit: 99, each: 30, budget: 10, who: "b" }), okLeft(29));
  await call(ASK_GUARD_PATH.spend, { neurons: 10 });
  assert.equal(await call(ASK_GUARD_PATH.take, { limit: 99, each: 30, budget: 10, who: "c" }), ASK_GUARD_REPLY.spent);
});

test("the guard turns away a request it can't read, and a path it doesn't have", async () => {
  const call = guardOver(new Map());
  assert.equal(await call(ASK_GUARD_PATH.take, { limit: 3, each: 30 }), 400);
  assert.equal(await call(ASK_GUARD_PATH.take, { limit: "lots", each: 30, who: "a" }), 400);
  assert.equal(await call(ASK_GUARD_PATH.take, { limit: 3, each: 30, budget: "lots", who: "a" }), 400);
  assert.equal(await call(ASK_GUARD_PATH.spend, {}), 400);
  assert.equal(await call(ASK_GUARD_PATH.spend, { neurons: -1 }), 400);
  assert.equal(await call(ASK_GUARD_PATH.block, { hours: -1, who: "a" }), 400);
  assert.equal(await call("/other", { who: "a" }), 404);
});
