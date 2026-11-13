/* Llama Guard's verdict on a question (src/worker/ask/moderation.ts): it's
   run cut short, waited for only so long, and counted as run whenever it
   was. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { LLAMA_GUARD_OPTIONS, LLAMA_GUARD_PROMPT_TOKENS, llamaGuardVerdict } from "../../src/worker/ask/moderation.ts";
import { models, toolCall, using } from "./support/models.ts";
import { stubs } from "./support/worker.ts";

// A Llama Guard that never says. Only what the call uses of Workers AI is stood in for.
const NEVER = { run: () => new Promise(() => {}) } as unknown as Ai;
const SOON_MS = 30;

test("Llama Guard is sent the question alone, and run cut short", async () => {
  const { askJson, guardCalls } = stubs({ run: models(toolCall("skills.1")) });
  await askJson("Postgres?");
  assert.deepEqual(guardCalls[0]?.input, {
    messages: [{ role: "user", content: "Postgres?" }],
    ...LLAMA_GUARD_OPTIONS,
  });
});

test("a Llama Guard slower than its time isn't waited for, and calls nothing unsafe", async () => {
  const started = Date.now();
  assert.equal((await llamaGuardVerdict(NEVER, "anything", SOON_MS)).isUnsafe, false);
  assert.ok(Date.now() - started < 1000);
});

test("one that says unsafe in time is heard", async () => {
  const unsafe = { run: async () => ({ response: "unsafe\nS1" }) } as unknown as Ai;
  assert.equal((await llamaGuardVerdict(unsafe, "anything", SOON_MS)).isUnsafe, true);
});

test("Llama Guard too slow to say is counted as run all the same", async () => {
  assert.deepEqual((await llamaGuardVerdict(NEVER, "abc", SOON_MS)).tokens, {
    input: LLAMA_GUARD_PROMPT_TOKENS + 1,
    output: LLAMA_GUARD_OPTIONS.max_tokens,
  });
});

test("one that says what it used is counted by that", async () => {
  const says = { run: async () => using({ response: "safe" }, 300, 2) } as unknown as Ai;
  assert.deepEqual((await llamaGuardVerdict(says, "abc", SOON_MS)).tokens, { input: 300, output: 2 });
});
