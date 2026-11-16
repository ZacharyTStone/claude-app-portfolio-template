/* The daily rebuild (src/worker/rebuild.ts): the cron trigger POSTs to the
   deploy hook, if the Worker has one, and logs one line of what came of it,
   which never has the hook's address in it. Workers Builds is stood in for. */
import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../../src/worker/index.ts";
import { rebuild, type Fetch, type RebuildLine } from "../../src/worker/rebuild.ts";
import { stubs } from "./support/worker.ts";

/** A deploy hook's address, as Workers Builds makes one: a credential. */
const HOOK = "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/0123456789abcdef";

/** What fetch() throws, in place of an answer. */
type Thrown = { throws: unknown };

/** Workers Builds, stood in for: it answers `answer`, or throws as fetch()
    throws, and keeps what it was asked. */
function buildsAnswering(answer: Response | Thrown) {
  const asked: Array<{ address: string; init: RequestInit }> = [];
  const fetch: Fetch = async (address, init) => {
    asked.push({ address, init });
    if ("throws" in answer) throw answer.throws;
    return answer;
  };
  return { fetch, asked };
}

/** What the rebuild logs, and what Workers Builds was asked. */
async function rebuildWith(env: { DEPLOY_HOOK_URL?: string }, answer: Response | Thrown) {
  const { fetch, asked } = buildsAnswering(answer);
  const logged: RebuildLine[] = [];
  await rebuild(env, fetch, (line) => logged.push(line));
  return { logged, asked };
}

const BUILD_STARTED = Response.json({ success: true, errors: [], messages: [], result: { build_uuid: "b1" } });

test("with the hook, it POSTs to it with a time limit, and logs that a build was started", async () => {
  const { logged, asked } = await rebuildWith({ DEPLOY_HOOK_URL: HOOK }, BUILD_STARTED);
  assert.deepEqual(
    asked.map(({ address, init }) => [address, init.method, init.signal instanceof AbortSignal]),
    [[HOOK, "POST", true]],
  );
  assert.deepEqual(logged, [{ rebuild: "started", status: 200 }]);
});

test("without the hook, it asks for nothing and logs nothing", async () => {
  for (const env of [{}, { DEPLOY_HOOK_URL: "" }]) {
    assert.deepEqual(await rebuildWith(env, BUILD_STARTED), { logged: [], asked: [] });
  }
});

test("a hook Workers Builds refuses (one that was deleted) is logged by the status it answered", async () => {
  const { logged } = await rebuildWith({ DEPLOY_HOOK_URL: HOOK }, new Response("Not found", { status: 404 }));
  assert.deepEqual(logged, [{ rebuild: "refused", status: 404 }]);
});

for (const [what, error, kind] of [
  ["no connection", new TypeError(`fetch failed: ${HOOK}`), "TypeError"],
  ["no answer in time", new DOMException(`Timed out asking ${HOOK}`, "TimeoutError"), "TimeoutError"],
  ["something thrown that isn't an error", HOOK, "unknown"],
] as const) {
  test(`${what} is logged by its kind, never by its message, which could have the hook in it`, async () => {
    const { logged } = await rebuildWith({ DEPLOY_HOOK_URL: HOOK }, { throws: error });
    assert.deepEqual(logged, [{ rebuild: "error", error: kind }]);
    assert.doesNotMatch(JSON.stringify(logged), /deploy_hooks|cloudflare/);
  });
}

test("the Worker's cron trigger runs the rebuild: one line of JSON to the console, without the hook", async (t) => {
  const printed = t.mock.method(console, "log", () => {});
  const fetched = t.mock.method(globalThis, "fetch", async () => BUILD_STARTED.clone());
  const { env } = stubs({ vars: { DEPLOY_HOOK_URL: HOOK } });
  await worker.scheduled({} as ScheduledController, env);
  assert.deepEqual(
    fetched.mock.calls.map((call) => call.arguments[0]),
    [HOOK],
  );
  const lines = printed.mock.calls.map((call) => String(call.arguments[0]));
  assert.deepEqual(lines, [JSON.stringify({ rebuild: "started", status: 200 })]);
});
