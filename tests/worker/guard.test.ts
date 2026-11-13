/* AskGuard (src/worker/guard/): the Durable Object that counts the day's
   questions, the site's and each visitor's, and what the site's cost and
   may yet, and keeps the blocks; what /ask says to it; and how /ask reads
   what it says back. Past any limit, or with the guard down, the model
   isn't asked. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { sum } from "es-toolkit";
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
import { limitsFrom } from "../../src/worker/guard/client.ts";
import { VISITOR_ADDRESS_HEADER } from "../../src/worker/lib/visitor.ts";
import { SETTINGS, readSettings } from "../../src/worker/settings.ts";
import { askedOf, firstAsked, guardStub, okLeft, realGuard, storageOver, type Stored } from "./support/guard.ts";
import { models, toolCall, using } from "./support/models.ts";
import { costs, stubs } from "./support/worker.ts";

test("what /ask asks of the guard reads back as it was asked", () => {
  const asked: Asked[] = [
    {
      ask: "take",
      visitorHash: "abc",
      networkHash: "def",
      limits: { siteLimit: 200, hourLimit: 67, visitorLimit: 30, networkLimit: 60, neuronBudget: 9000 },
    },
    { ask: "block", visitorHash: "abc", hours: 24 },
    { ask: "spend", neurons: 21.25 },
    { ask: "spend", neurons: 0 },
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
  const defaults = limitsFrom(readSettings({}));
  assert.deepEqual(
    [defaults.siteLimit, defaults.visitorLimit, defaults.neuronBudget],
    [SETTINGS.dailyLimit.default, SETTINGS.visitorLimit.default, SETTINGS.neuronBudget.default],
  );
  assert.deepEqual(await limitsAsked(), defaults);
  const set = { ASK_DAILY_LIMIT: "7", ASK_VISITOR_LIMIT: "5", ASK_DAILY_NEURONS: "1200" };
  assert.deepEqual(await limitsAsked(set), {
    ...limitsFrom(readSettings(set)),
    siteLimit: 7,
    visitorLimit: 5,
    neuronBudget: 1200,
  });
  for (const bad of ["0", "-1", "Infinity", "lots"]) {
    const unreadable = { ASK_DAILY_LIMIT: bad, ASK_VISITOR_LIMIT: bad, ASK_DAILY_NEURONS: bad };
    assert.deepEqual(await limitsAsked(unreadable), defaults);
  }
});

test("the site's hour is a third of its day, and a network's day is two visitors'", () => {
  assert.deepEqual(limitsFrom(readSettings({})), {
    siteLimit: 200,
    hourLimit: 67,
    visitorLimit: 30,
    networkLimit: 60,
    neuronBudget: 9000,
  });
});

test("a visitor alone can ask all they may within an hour, however small the site's day", () => {
  const small = readSettings({ ASK_DAILY_LIMIT: "30", ASK_VISITOR_LIMIT: "30" });
  assert.equal(limitsFrom(small).hourLimit, 30);
});

/** How many of `addresses`' questions, thirty from each, a Worker over the
    real AskGuard answers. */
async function answeredOf(world: ReturnType<typeof stubs>, addresses: string[]): Promise<number> {
  let answered = 0;
  for (const address of addresses) {
    for (let question = 0; question < 30; question++) {
      const response = await world.ask(
        { question: "who?", lang: "en" },
        { headers: { [VISITOR_ADDRESS_HEADER]: address } },
      );
      if (((await response.json()) as { id?: unknown }).id === "about.1") answered++;
    }
  }
  return answered;
}
const SEVEN = [0, 1, 2, 3, 4, 5, 6];
const FROM_ELSEWHERE = { headers: { [VISITOR_ADDRESS_HEADER]: "192.0.2.77" } };

test("seven addresses in one network get that network's allowance, and the next visitor is answered", async () => {
  const world = stubs({ guard: realGuard() });
  const answered = await answeredOf(
    world,
    SEVEN.map((n) => `198.51.100.${n}`),
  );
  const next = await world.ask({ question: "who?", lang: "en" }, FROM_ELSEWHERE);
  assert.deepEqual([answered, await next.json()], [60, { id: "about.1" }]);
});

test("addresses in seven networks use up the site's hour, not its day: Ask is back in the next hour", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-31T14:10:00Z") });
  const world = stubs({ guard: realGuard() });
  const answered = await answeredOf(
    world,
    SEVEN.map((n) => `198.51.${n}.1`),
  );
  const thatHour = await world.ask({ question: "who?", lang: "en" }, FROM_ELSEWHERE);
  t.mock.timers.setTime(Date.parse("2026-01-31T15:00:00Z"));
  const nextHour = await world.ask({ question: "who?", lang: "en" }, FROM_ELSEWHERE);
  assert.deepEqual(
    [answered, await thatHour.json(), await nextHour.json()],
    [67, { id: null, why: "budget" }, { id: "about.1" }],
  );
});

test("a flagged question blocks its address for an hour, and whoever shares it can ask again after that", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-31T14:10:00Z") });
  const guard = realGuard();
  assert.deepEqual(await stubs({ guard, run: models(toolCall(INAPPROPRIATE)) }).askJson("rude"), {
    blocked: true,
    flagged: true,
  });
  const colleague = stubs({ guard });
  t.mock.timers.setTime(Date.parse("2026-01-31T15:09:00Z"));
  const withinTheHour = await colleague.askJson("who?");
  t.mock.timers.setTime(Date.parse("2026-01-31T15:11:00Z"));
  assert.deepEqual([withinTheHour, await colleague.askJson("who?")], [{ blocked: true }, { id: "about.1" }]);
});

test("a block ends when the day does, even one set for longer: the next day's hash is another", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-31T23:50:00Z") });
  const guard = realGuard();
  await stubs({ guard, run: models(toolCall(INAPPROPRIATE)), vars: { ASK_BLOCK_HOURS: "24" } }).askJson("rude");
  const colleague = stubs({ guard });
  const thatDay = await colleague.askJson("who?");
  t.mock.timers.setTime(Date.parse("2026-02-01T00:10:00Z"));
  assert.deepEqual([thatDay, await colleague.askJson("who?")], [{ blocked: true }, { id: "about.1" }]);
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

// An AskGuard over `stored`, whose storage takes at most MAX_KEYS_PER_DELETE keys
// to a delete, as Cloudflare's does.
function guardAndStorage(stored: Stored) {
  const storage = storageOver(stored, MAX_KEYS_PER_DELETE);
  // Only the storage calls AskGuard makes are stood in for.
  return { storage, guard: new AskGuard({ storage } as unknown as DurableObjectState) };
}

// A way to ask `guard` at a path with a query: what it says, or the status
// it turns the request away with.
const asking = (guard: AskGuard) => async (path: string, query: Record<string, string | number>) => {
  const search = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
  const response = await guard.fetch(new Request(`https://guard${path}?${search}`, { method: "POST" }));
  return response.ok ? response.text() : response.status;
};

const guardOver = (stored: Stored) => asking(guardAndStorage(stored).guard);

/** An hour's share and a network's allowance too large to be met: for a
    test of another limit. */
const ROOMY = { hourly: 999, shared: 999 };

const used = (stored: Stored) => (stored.get(ASK_GUARD_KEYS.today) as { used: number } | undefined)?.used;
const spent = (stored: Stored) => (stored.get(ASK_GUARD_KEYS.today) as { neurons?: number } | undefined)?.neurons;

/** Has the guard take a question and, as the Worker does once it has
    answered one, pays for it: the next isn't held back for it. */
async function takenAndPaid(call: ReturnType<typeof guardOver>, query: Record<string, string | number>) {
  const taken = await call(ASK_GUARD_PATH.take, query);
  if (String(taken).startsWith(ASK_GUARD_REPLY.ok)) await call(ASK_GUARD_PATH.spend, { neurons: 1 });
  return taken;
}

/** A guard over `stored`, and a way to have it take a question from `who`. */
function taking(stored: Stored = new Map()) {
  const call = guardOver(stored);
  const take = (who: string, limit: number, each: number) =>
    takenAndPaid(call, { limit, each, ...ROOMY, budget: 9000, who, net: who });
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

test("in an hour the site takes no more than the hour's share, and takes again in the next", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-31T14:10:00Z") });
  const call = guardOver(new Map());
  const take = (who: string) =>
    takenAndPaid(call, { limit: 99, hourly: 2, each: 30, shared: 99, budget: 9000, who, net: who });
  const thisHour = [await take("a"), await take("b"), await take("c")];
  t.mock.timers.setTime(Date.parse("2026-01-31T15:00:00Z"));
  assert.deepEqual([...thisHour, await take("c")], [okLeft(29), okLeft(29), ASK_GUARD_REPLY.spent, okLeft(29)]);
});

test("addresses in one network share its allowance, and another network has its own", async () => {
  const call = guardOver(new Map());
  const take = (who: string, net: string) =>
    takenAndPaid(call, { limit: 99, hourly: 99, each: 30, shared: 2, budget: 9000, who, net });
  assert.deepEqual(
    [await take("a", "office"), await take("b", "office"), await take("c", "office"), await take("d", "home")],
    [okLeft(1), okLeft(0), ASK_GUARD_REPLY.limited, okLeft(1)],
  );
});

test("what's kept of a visitor sets an alarm for the day's end, and one that's set is left as it is", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-31T14:10:00Z") });
  for (const [path, query] of [
    [ASK_GUARD_PATH.take, { limit: 3, each: 30, ...ROOMY, who: "a", net: "n" }],
    [ASK_GUARD_PATH.block, { hours: 1, who: "a" }],
  ] as const) {
    const { guard, storage } = guardAndStorage(new Map());
    const call = asking(guard);
    assert.equal(await storage.getAlarm(), null);
    await call(path, query);
    assert.equal(await storage.getAlarm(), Date.parse("2026-02-01T00:00:00Z"), path);
    await storage.setAlarm(1);
    await call(path, query);
    assert.equal(await storage.getAlarm(), 1, path);
  }
});

test("a question turned away, or paid for, keeps nothing of a visitor and sets no alarm", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-31T14:10:00Z") });
  const stored: Stored = new Map([[ASK_GUARD_KEYS.today, { day: "2026-01-31", used: 3 }]]);
  const { guard, storage } = guardAndStorage(stored);
  const call = asking(guard);
  await call(ASK_GUARD_PATH.spend, { neurons: 5 });
  assert.equal(
    await call(ASK_GUARD_PATH.take, { limit: 3, each: 30, ...ROOMY, who: "a", net: "n" }),
    ASK_GUARD_REPLY.spent,
  );
  assert.equal(await storage.getAlarm(), null);
});

test("the alarm deletes all that's kept of visitors, however many and whatever day's, and keeps the site's counts", async () => {
  const stored: Stored = new Map();
  const { guard } = guardAndStorage(stored);
  const call = asking(guard);
  await call(ASK_GUARD_PATH.take, { limit: 3, each: 30, ...ROOMY, who: "a", net: "n" });
  await call(ASK_GUARD_PATH.spend, { neurons: 5 });
  for (let i = 0; i < MAX_KEYS_PER_DELETE * 2 + 1; i++) {
    stored.set(`${ASK_GUARD_KEYS.count}${i}`, { day: "2000-01-01", asked: 1 });
    stored.set(`${ASK_GUARD_KEYS.block}old${i}`, Date.now() - 1);
  }
  stored.set(`${ASK_GUARD_KEYS.network}old`, { day: "2000-01-01", asked: 1 });
  stored.set(`${ASK_GUARD_KEYS.block}still`, Date.now() + 60_000);
  await guard.alarm();
  assert.deepEqual([...stored.keys()].sort(), [ASK_GUARD_KEYS.dearest, ASK_GUARD_KEYS.hour, ASK_GUARD_KEYS.today]);
});

test("the next day's first question starts the site's count again and deletes nothing itself", async () => {
  const stored: Stored = new Map<string, unknown>([
    [ASK_GUARD_KEYS.today, { day: "2000-01-01", used: 3 }],
    [`${ASK_GUARD_KEYS.count}old`, { day: "2000-01-01", asked: 30 }],
  ]);
  assert.equal(
    await guardOver(stored)(ASK_GUARD_PATH.take, { limit: 3, each: 30, ...ROOMY, who: "a", net: "n" }),
    okLeft(29),
  );
  assert.equal(used(stored), 1);
  assert.ok(stored.has(`${ASK_GUARD_KEYS.count}old`), "that's the alarm's to delete");
});

/** A guard over `stored`, and a way to have it take a question against a
    budget of Neurons. */
function budgeting(stored: Stored = new Map()) {
  const call = guardOver(stored);
  const take = (who: string, budget: number | string = 100) =>
    call(ASK_GUARD_PATH.take, { limit: 99, each: 30, ...ROOMY, budget, who, net: who });
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

test("a question not yet paid for is counted at the most one has cost, and is no longer once it's paid for", async () => {
  const { call, take } = budgeting();
  await take("a");
  await call(ASK_GUARD_PATH.spend, { neurons: 40 });
  // 40 spent, and two more at 40 each would pass 100: there's no room for a third.
  assert.deepEqual(
    [await take("b"), await take("c"), await take("d")],
    [okLeft(29), okLeft(29), ASK_GUARD_REPLY.spent],
  );
  await call(ASK_GUARD_PATH.spend, { neurons: 40 });
  assert.equal(await take("d"), ASK_GUARD_REPLY.spent, "80 spent, and one more on its way");
  await call(ASK_GUARD_PATH.spend, { neurons: 0 });
  assert.equal(await take("d"), okLeft(29), "the other failed, and was paid for with nothing");
});

test("before any question has been paid for they're taken one at a time, as after one that failed", async () => {
  const { call, take } = budgeting();
  assert.deepEqual([await take("a"), await take("b")], [okLeft(29), ASK_GUARD_REPLY.spent]);
  await call(ASK_GUARD_PATH.spend, { neurons: 0 });
  assert.deepEqual([await take("b"), await take("c")], [okLeft(29), ASK_GUARD_REPLY.spent]);
  await call(ASK_GUARD_PATH.spend, { neurons: 10 });
  assert.deepEqual([await take("c"), await take("d")], [okLeft(29), okLeft(29)]);
});

test("the next day none is unpaid, and the most a question has cost is still known", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-31T23:50:00Z") });
  const { call, take } = budgeting();
  await take("a");
  await call(ASK_GUARD_PATH.spend, { neurons: 40 });
  await take("b");
  t.mock.timers.setTime(Date.parse("2026-02-01T00:10:00Z"));
  // At 40 each, 100 Neurons have room for three at once.
  assert.deepEqual(
    [await take("c"), await take("d"), await take("e"), await take("f")],
    [okLeft(29), okLeft(29), okLeft(29), ASK_GUARD_REPLY.spent],
  );
});

test("a burst asked all at once stops within a question's cost of the day's Neurons", async () => {
  const BUDGET = 1000;
  const guard = realGuard();
  let letTheModelsAnswer = () => {};
  let held: Promise<void> = Promise.resolve();
  const world = stubs({
    guard,
    vars: { ASK_DAILY_NEURONS: String(BUDGET) },
    run: async (...call) => {
      await held;
      return models(using(toolCall("about.1"), 7000, 150))(...call);
    },
  });
  const askFrom = (address: string) =>
    world.ask({ question: "who?", lang: "en" }, { headers: { [VISITOR_ADDRESS_HEADER]: address } });
  await askFrom("192.0.2.77");
  const each = Number(costs(world.logged)[0]);

  held = new Promise((resolve) => (letTheModelsAnswer = resolve));
  const burst = Array.from({ length: 40 }, (_, n) => askFrom(`198.51.${n}.1`));
  while (askedOf(guard).filter((asked) => asked.ask === "take").length <= burst.length) await nextTurn();
  letTheModelsAnswer();
  await Promise.all(burst);

  const counted = sum(costs(world.logged).filter((cost) => typeof cost === "number"));
  assert.ok(counted > BUDGET - each && counted < BUDGET + each, `${counted} Neurons, at ${each} a question`);
});

test("a larger budget lets the day go on, and a request with none has no limit", async () => {
  const { call, take } = await aDayAtItsBudget();
  assert.equal(await take("c", 101), okLeft(29));
  assert.equal(await call(ASK_GUARD_PATH.take, { limit: 99, each: 30, ...ROOMY, who: "d", net: "d" }), okLeft(29));
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
  assert.equal(
    await call(ASK_GUARD_PATH.take, { limit: 99, each: 30, ...ROOMY, budget: 10, who: "a", net: "a" }),
    okLeft(29),
  );
  const today = stored.get(ASK_GUARD_KEYS.today) as { day: string; used: number };
  stored.set(ASK_GUARD_KEYS.today, { day: today.day, used: today.used });
  assert.equal(
    await call(ASK_GUARD_PATH.take, { limit: 99, each: 30, ...ROOMY, budget: 10, who: "b", net: "b" }),
    okLeft(29),
  );
  await call(ASK_GUARD_PATH.spend, { neurons: 10 });
  assert.equal(
    await call(ASK_GUARD_PATH.take, { limit: 99, each: 30, ...ROOMY, budget: 10, who: "c", net: "c" }),
    ASK_GUARD_REPLY.spent,
  );
});

test("the guard turns away a request it can't read, and a path it doesn't have", async () => {
  const call = guardOver(new Map());
  const take = { limit: 3, each: 30, ...ROOMY, who: "a", net: "a" };
  assert.equal(await call(ASK_GUARD_PATH.take, { ...take, who: "" }), 400);
  assert.equal(await call(ASK_GUARD_PATH.take, { ...take, net: "" }), 400);
  assert.equal(await call(ASK_GUARD_PATH.take, { ...take, limit: "lots" }), 400);
  assert.equal(await call(ASK_GUARD_PATH.take, { ...take, hourly: 0 }), 400);
  assert.equal(await call(ASK_GUARD_PATH.take, { ...take, shared: "lots" }), 400);
  assert.equal(await call(ASK_GUARD_PATH.take, { ...take, budget: "lots" }), 400);
  assert.equal(await call(ASK_GUARD_PATH.spend, {}), 400);
  assert.equal(await call(ASK_GUARD_PATH.spend, { neurons: -1 }), 400);
  assert.equal(await call(ASK_GUARD_PATH.block, { hours: -1, who: "a" }), 400);
  assert.equal(await call("/other", { who: "a" }), 404);
});
