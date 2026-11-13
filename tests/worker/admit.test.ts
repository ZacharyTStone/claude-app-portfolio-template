/* Whether a question may go to the model (src/worker/ask/admit.ts): only
   with Ask on, from a visitor under the minute's and the day's limits who
   isn't blocked, with a limiter and a guard there to count it. The visitor
   is known only by a salted hash of their address, another one each day. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ASK_GUARD_REPLY } from "../../src/worker/guard/wire.ts";
import { VISITOR_ADDRESS_HEADER } from "../../src/worker/lib/visitor.ts";
import { SETTINGS } from "../../src/worker/settings.ts";
import { askedOf, firstAsked } from "./support/guard.ts";
import { models, toolCall, using } from "./support/models.ts";
import { ADDRESS, hashToday, lines, stubs } from "./support/worker.ts";

test("turned off, it doesn't call the model", async () => {
  for (const ASK_ENABLED of ["false", "TRUE", ""]) {
    const { askJson, calls } = stubs({ vars: { ASK_ENABLED } });
    assert.deepEqual(await askJson("who?"), { id: null, why: "off" });
    assert.equal(calls.length, 0);
  }
});

test("over the rate limit: 429, no model call", async () => {
  const { ask, calls } = stubs({ limit: async () => ({ success: false }) });
  assert.equal((await ask({ question: "who?", lang: "en" })).status, 429);
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
    const { ask, calls, logged } = stubs(options);
    const response = await ask({ question: "who?", lang: "en" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: null, why: "budget" });
    assert.equal(calls.length, 0);
    assert.deepEqual(lines(logged), ['{"ask":"refused","why":"down"}']);
  }
});

test("with no guard to count what it costs, a question isn't asked of the model at all", async () => {
  const pick = using(toolCall("skills.1"), 4000, 40);
  const safe = using({ response: "safe" }, 300, 2);
  const { askJson, calls } = stubs({ run: models(pick, safe), without: ["ASK_GUARD"] });
  assert.deepEqual(await askJson("Postgres?"), { id: null, why: "budget" });
  assert.equal(calls.length, 0);
});

test("the visitor is known by a salted hash of their address, never the address", async () => {
  const { askJson, guard } = stubs();
  await askJson("who?");
  assert.equal(firstAsked(guard, "take")?.visitorHash, hashToday(SETTINGS.salt.default, ADDRESS));
});

test("the next day the same address is known by another hash, to the guard and the limiter alike", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-31T23:50:00Z") });
  const { askJson, guard, limitKeys } = stubs();
  await askJson("who?");
  const thatDay = hashToday(SETTINGS.salt.default, ADDRESS);
  t.mock.timers.setTime(Date.parse("2026-02-01T00:10:00Z"));
  await askJson("who?");
  const nextDay = hashToday(SETTINGS.salt.default, ADDRESS);
  assert.notEqual(thatDay, nextDay);
  assert.deepEqual(limitKeys, [thatDay, nextDay]);
  assert.deepEqual(
    askedOf(guard).flatMap((asked) => (asked.ask === "take" ? [asked.visitorHash] : [])),
    [thatDay, nextDay],
  );
});

test("ASK_SALT, when it's set, is what the address is hashed with", async () => {
  const { askJson, guard } = stubs({ vars: { ASK_SALT: "a secret" } });
  await askJson("who?");
  assert.equal(firstAsked(guard, "take")?.visitorHash, hashToday("a secret", ADDRESS));
});

test("an IPv6 visitor is known by their /64: every address in it is one visitor", async () => {
  const hashes = new Set<string | null | undefined>();
  for (const address of ["2001:db8:1:2::1", "2001:DB8:1:2::2", "2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd"]) {
    const { ask, guard, limitKeys } = stubs();
    await ask({ question: "who?", lang: "en" }, { headers: { [VISITOR_ADDRESS_HEADER]: address } });
    hashes.add(firstAsked(guard, "take")?.visitorHash);
    hashes.add(limitKeys[0]);
  }
  assert.equal(hashes.size, 1, "one hash for the guard and the limiter alike");
  const other = stubs();
  await other.ask({ question: "who?", lang: "en" }, { headers: { [VISITOR_ADDRESS_HEADER]: "2001:db8:1:3::1" } });
  assert.ok(!hashes.has(other.limitKeys[0]), "the next /64 is someone else");
});

test("the rate limit is keyed by the visitor's hash, the same one AskGuard counts by", async () => {
  const { askJson, guard, limitKeys } = stubs();
  await askJson("who?");
  assert.deepEqual(limitKeys, [firstAsked(guard, "take")?.visitorHash]);
  assert.match(limitKeys[0] ?? "", /^[0-9a-f]{32}$/);
});

test("a blocked asker gets { blocked } with no model call", async () => {
  const { askJson, calls } = stubs({ guardSays: ASK_GUARD_REPLY.blocked });
  assert.deepEqual(await askJson("who?"), { blocked: true });
  assert.equal(calls.length, 0);
});

test("past the visitor's limit: { limited } with the limit, no model call", async () => {
  for (const [vars, limit] of [
    [{}, SETTINGS.visitorLimit.default],
    [{ ASK_VISITOR_LIMIT: "5" }, 5],
  ] as const) {
    const { askJson, calls } = stubs({ guardSays: ASK_GUARD_REPLY.limited, vars });
    assert.deepEqual(await askJson("who?"), { id: null, limited: true, limit });
    assert.equal(calls.length, 0);
  }
});

test("a question turned away at the guard is logged with why, and nothing else", async () => {
  for (const says of [ASK_GUARD_REPLY.blocked, ASK_GUARD_REPLY.limited, ASK_GUARD_REPLY.spent, "down"]) {
    const { askJson, logged } = stubs({ guardSays: says });
    await askJson("Is he tall?");
    assert.deepEqual(lines(logged), [`{"ask":"refused","why":"${says}"}`]);
  }
});
