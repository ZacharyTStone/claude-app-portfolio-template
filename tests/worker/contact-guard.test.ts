/* AskGuard's count of the contact form's messages (src/worker/guard/): the
   site's day and each visitor's, kept apart from Ask's questions, and
   forgotten as the day ends. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ASK_GUARD_KEYS, AskGuard } from "../../src/worker/guard/ask-guard.ts";
import { ASK_GUARD_PATH, ASK_GUARD_REPLY, readMessageTaken, urlAsking } from "../../src/worker/guard/wire.ts";
import { storageOver, type Stored } from "./support/guard.ts";

/** A guard over `stored`, and a way to have it take a message from `who`
    against limits of `limit` for the site and `each` for a visitor: what
    it says, or the status it turns the request away with. */
function messagesTo(stored: Stored = new Map()) {
  const storage = storageOver(stored);
  // Only the storage calls AskGuard makes are stood in for.
  const guard = new AskGuard({ storage } as unknown as DurableObjectState);
  const take = async (who: string, limit = 20, each = 3) => {
    const url = urlAsking({ ask: "message", visitorHash: who, limits: { siteLimit: limit, visitorLimit: each } });
    const response = await guard.fetch(new Request(url, { method: "POST" }));
    return response.ok ? response.text() : response.status;
  };
  return { stored, storage, guard, take };
}

test("what the guard says of a message reads back as it was said, and anything else as down", () => {
  assert.deepEqual(
    [ASK_GUARD_REPLY.ok, ASK_GUARD_REPLY.limited, ASK_GUARD_REPLY.spent, ASK_GUARD_REPLY.blocked, "ok 3", ""].map(
      readMessageTaken,
    ),
    [
      { state: "ok" },
      { state: "limited" },
      { state: "spent" },
      { state: "down" },
      { state: "down" },
      { state: "down" },
    ],
  );
});

test("a visitor's messages are counted for the day, and past their limit they send none", async () => {
  const { take } = messagesTo();
  const theirs = [await take("a", 20, 2), await take("a", 20, 2), await take("a", 20, 2)];
  assert.deepEqual(theirs, [ASK_GUARD_REPLY.ok, ASK_GUARD_REPLY.ok, ASK_GUARD_REPLY.limited]);
  assert.equal(await take("b", 20, 2), ASK_GUARD_REPLY.ok);
});

test("the site's day is counted across visitors, and one turned away counts nothing", async () => {
  const { stored, take } = messagesTo();
  const replies = [];
  for (const who of ["a", "b", "c", "d"]) replies.push(await take(who, 3));
  assert.deepEqual(replies, [ASK_GUARD_REPLY.ok, ASK_GUARD_REPLY.ok, ASK_GUARD_REPLY.ok, ASK_GUARD_REPLY.spent]);
  assert.ok(!stored.has(`${ASK_GUARD_KEYS.message}d`));
});

test("a message is counted under keys of its own, apart from the questions'", async () => {
  const { stored, take } = messagesTo();
  await take("a");
  assert.deepEqual([...stored.keys()].sort(), [`${ASK_GUARD_KEYS.message}a`, ASK_GUARD_KEYS.messages].sort());
});

test("the next day starts from nothing", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-31T23:50:00Z") });
  const { take } = messagesTo();
  assert.deepEqual([await take("a", 1, 1), await take("a", 1, 1)], [ASK_GUARD_REPLY.ok, ASK_GUARD_REPLY.spent]);
  t.mock.timers.setTime(Date.parse("2026-02-01T00:10:00Z"));
  assert.equal(await take("a", 1, 1), ASK_GUARD_REPLY.ok);
});

test("a message taken sets an alarm for the day's end, which forgets every visitor's count", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-31T14:10:00Z") });
  const { stored, storage, guard, take } = messagesTo();
  await take("a");
  assert.equal(await storage.getAlarm(), Date.parse("2026-02-01T00:00:00Z"));
  await guard.alarm();
  assert.deepEqual([...stored.keys()], [ASK_GUARD_KEYS.messages]);
});

test("the guard turns away a message it can't read", async () => {
  const { guard } = messagesTo();
  for (const query of ["limit=20&each=3", "limit=0&each=3&who=a", "limit=20&each=lots&who=a"]) {
    const response = await guard.fetch(new Request(`https://guard${ASK_GUARD_PATH.message}?${query}`));
    assert.equal(response.status, 400, query);
  }
});
