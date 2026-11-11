/* The limits on cost: the rate limiter, and the day's allowances kept by
   AskGuard (the site's and each visitor's). Past any limit, or with either
   missing or down, the model isn't asked. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DELETE_BATCH,
  GUARD_KEYS,
  GUARD_NAME,
  GUARD_PATH,
  GUARD_REPLY,
  INAPPROPRIATE,
  WARN_AT,
} from "../../src/worker/constants.ts";
import { DEFAULTS } from "../../src/worker/env.ts";
import { AskGuard } from "../../src/worker/index.ts";
import { ask, askJson, captureLogs, guardStub, lines, models, okLeft, stubs, toolCall } from "./fixtures.ts";

const logs = captureLogs();

test("over the rate limit: 429, no model call", async () => {
  const { env, calls } = stubs({ limit: async () => ({ success: false }) });
  assert.equal((await ask(env, { question: "who?", lang: "en" })).status, 429);
  assert.equal(calls.length, 0);
});

test("a limiter or guard that's missing or fails lets nothing through, and still answers as /ask does", async () => {
  const failing = async (): Promise<{ success: boolean }> => {
    throw new Error("rate limiter unavailable");
  };
  for (const options of [
    { without: ["ASK_LIMIT" as const] },
    { without: ["ASK_GUARD" as const] },
    { limit: failing },
  ]) {
    logs.mock.resetCalls();
    const { env, calls } = stubs(options);
    const response = await ask(env, { question: "who?", lang: "en" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: null, why: "budget" });
    assert.equal(calls.length, 0);
    assert.deepEqual(lines(logs), ['{"ask":"refused","why":"down"}']);
  }
});

test("the rate limit is keyed by the visitor's hash, the same one AskGuard counts by", async () => {
  const { env, guard, limitKeys } = stubs();
  await askJson(env, "who?");
  assert.deepEqual(limitKeys, [guard.requests[0]?.searchParams.get("who")]);
  assert.match(limitKeys[0] ?? "", /^[0-9a-f]{32}$/);
});

test("AskGuard is asked with the site's and the visitor's daily limits, as set or by default", async () => {
  const take = async (vars = {}) => {
    const { env, guard } = stubs({ vars });
    await askJson(env, "who?");
    const url = guard.requests.find((request) => request.pathname === GUARD_PATH.take);
    return [url?.searchParams.get("limit"), url?.searchParams.get("each")];
  };
  assert.deepEqual(await take(), [String(DEFAULTS.dailyLimit), String(DEFAULTS.visitorLimit)]);
  assert.deepEqual(await take({ ASK_DAILY_LIMIT: "7", ASK_VISITOR_LIMIT: "5" }), ["7", "5"]);
  for (const bad of ["0", "-1", "Infinity", "lots"]) {
    assert.deepEqual(await take({ ASK_DAILY_LIMIT: bad, ASK_VISITOR_LIMIT: bad }), [
      String(DEFAULTS.dailyLimit),
      String(DEFAULTS.visitorLimit),
    ]);
  }
});

test("the site's daily allowance spent, or its counter down or unreadable: no model call", async () => {
  for (const guard of [
    guardStub(GUARD_REPLY.spent),
    guardStub("down"),
    guardStub(okLeft(25), 500),
    guardStub("maybe 3"),
    guardStub(""),
  ]) {
    const { env, calls } = stubs({ guard });
    assert.deepEqual(await askJson(env, "who?"), { id: null, why: "budget" });
    assert.equal(calls.length, 0);
  }
});

test("a question turned away at the guard is logged with why, and nothing else", async () => {
  for (const says of [GUARD_REPLY.blocked, GUARD_REPLY.limited, GUARD_REPLY.spent, "down"]) {
    logs.mock.resetCalls();
    await askJson(stubs({ guardSays: says }).env, "Is he tall?");
    assert.deepEqual(lines(logs), [`{"ask":"refused","why":"${says}"}`]);
  }
});

test("the guard is one object, placed where ASK_GUARD_LOCATION says, and anything else is the default", async () => {
  for (const [location, expected] of [
    [undefined, DEFAULTS.guardLocation],
    ["weur", "weur"],
    ["apac", "apac"],
    ["mars", DEFAULTS.guardLocation],
    ["", DEFAULTS.guardLocation],
  ]) {
    const { env, guard } = stubs({ run: models(toolCall(INAPPROPRIATE)), vars: { ASK_GUARD_LOCATION: location } });
    await askJson(env, "rude");
    assert.deepEqual(guard.last, { id: GUARD_NAME, options: { locationHint: expected } }, `${location}`);
    assert.ok(
      guard.requests.some((url) => url.pathname === GUARD_PATH.block),
      "the block goes to the same guard",
    );
  }
});

test("with WARN_AT questions left or fewer, the reply says how many", async () => {
  for (const [left, said] of [
    [WARN_AT, { id: "skills.1", left: WARN_AT }],
    [WARN_AT + 1, { id: "skills.1" }],
  ] as const) {
    const { env } = stubs({ run: models(toolCall("skills.1")), guardSays: okLeft(left) });
    assert.deepEqual(await askJson(env, "Postgres?"), said);
  }
});

test("past the visitor's limit: { limited } with the limit, no model call", async () => {
  for (const [vars, limit] of [
    [{}, DEFAULTS.visitorLimit],
    [{ ASK_VISITOR_LIMIT: "5" }, 5],
  ] as const) {
    const { env, calls } = stubs({ guardSays: GUARD_REPLY.limited, vars });
    assert.deepEqual(await askJson(env, "who?"), { id: null, limited: true, limit });
    assert.equal(calls.length, 0);
  }
});

// ---- AskGuard itself ---------------------------------------------------------------------

type Stored = Map<string, unknown>;

// An AskGuard over `stored`, whose storage takes at most DELETE_BATCH keys
// to a delete, as Cloudflare's does.
function guardOver(stored: Stored) {
  const storage = {
    get: async (key: string) => stored.get(key),
    put: async (key: string, value: unknown) => void stored.set(key, value),
    delete: async (keys: string | string[]) => {
      const all = [keys].flat();
      if (all.length > DELETE_BATCH) throw new Error(`delete: ${all.length} keys`);
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

const used = (stored: Stored) => (stored.get(GUARD_KEYS.today) as { used: number } | undefined)?.used;

test("the guard counts the site's and each visitor's day, and holds blocks until they run out", async () => {
  const stored: Stored = new Map();
  const call = guardOver(stored);
  const take = (who: string, limit: number, each: number) => call(GUARD_PATH.take, { limit, each, who });
  // The site's daily limit (3), across visitors.
  const replies = [];
  for (const who of ["a", "b", "c", "d"]) replies.push(await take(who, 3, 30));
  assert.deepEqual(replies, [okLeft(29), okLeft(29), okLeft(29), GUARD_REPLY.spent]);
  // One visitor's daily limit (2), while others carry on; one turned away
  // spends nothing of the site's.
  stored.clear();
  const theirs = [];
  for (let i = 0; i < 3; i++) theirs.push(await take("e", 99, 2));
  assert.deepEqual(theirs, [okLeft(1), okLeft(0), GUARD_REPLY.limited]);
  assert.equal(used(stored), 2);
  assert.equal(await take("f", 99, 2), okLeft(1));
  // Blocks hold until they run out, and a blocked visitor spends nothing.
  await call(GUARD_PATH.block, { hours: 24, who: "g" });
  assert.equal(await take("g", 99, 30), GUARD_REPLY.blocked);
  assert.equal(used(stored), 3);
  stored.set(`${GUARD_KEYS.block}g`, Date.now() - 1);
  assert.equal(await take("g", 99, 30), okLeft(29));
});

test("a new day forgets every visitor's count and the blocks run out, however many, and keeps the rest", async () => {
  const stored: Stored = new Map([[GUARD_KEYS.today, { day: "2000-01-01", used: 3 }]]);
  for (let i = 0; i < DELETE_BATCH * 2 + 1; i++) {
    stored.set(`${GUARD_KEYS.count}${i}`, { day: "2000-01-01", asked: 1 });
    stored.set(`${GUARD_KEYS.block}old${i}`, Date.now() - 1);
  }
  stored.set(`${GUARD_KEYS.block}still`, Date.now() + 60_000);
  assert.equal(await guardOver(stored)(GUARD_PATH.take, { limit: 3, each: 30, who: "a" }), okLeft(29));
  assert.deepEqual(
    [...stored.keys()].sort(),
    [`${GUARD_KEYS.block}still`, `${GUARD_KEYS.count}a`, GUARD_KEYS.today].sort(),
  );
});

test("the guard turns away a request it can't read, and a path it doesn't have", async () => {
  const call = guardOver(new Map());
  assert.equal(await call(GUARD_PATH.take, { limit: 3, each: 30 }), 400);
  assert.equal(await call(GUARD_PATH.take, { limit: "lots", each: 30, who: "a" }), 400);
  assert.equal(await call(GUARD_PATH.block, { hours: -1, who: "a" }), 400);
  assert.equal(await call("/other", { who: "a" }), 404);
});
