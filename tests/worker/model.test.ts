/* The one place Workers AI is called (src/worker/ask/model.ts): what a call
   is sent, how long its reply is waited for, and what it's counted as using. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { estimateJsonTokens } from "../../src/worker/ask/cost.ts";
import { DEFAULT_MODEL, reasoningOptionsOf } from "../../src/worker/ask/known-models.ts";
import { callForText, callModel, tokensUsed, type Prompt } from "../../src/worker/ask/model.ts";
import { using, writer, wrote } from "./support/models.ts";

const INPUT = { messages: [{ role: "user", content: "Who is Alex?" }] };
const BY_SIZE = { prompt: INPUT, maxOutputTokens: 50 };
const PROMPT: Prompt = { messages: [{ role: "user", content: "Who is Alex?" }], temperature: 0 };

// A model that never replies. Only what a call uses of Workers AI is stood in for.
const NEVER = { run: () => new Promise(() => {}) } as unknown as Ai;
const SOON_MS = 20;

const WORKER = join(import.meta.dirname, "../../src/worker");

test("Workers AI is called from ask/model.ts, and from nowhere else in the Worker", () => {
  const callers = readdirSync(WORKER, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => /\.run\(/.test(readFileSync(join(WORKER, file), "utf8")));
  assert.deepEqual(callers, [join("ask", "model.ts")]);
});

test("the model is sent the call's input, whole", async () => {
  const { ai, sent } = writer(wrote("Alex is an engineer."));
  await callModel(ai, DEFAULT_MODEL, { input: INPUT, tokensIfUnreported: BY_SIZE });
  assert.deepEqual(sent, [INPUT]);
});

test("a call resolves to the model's reply, counted by what the reply says it used", async () => {
  const reply = using(wrote("Alex is an engineer."), 300, 12);
  assert.deepEqual(await callModel(writer(reply).ai, DEFAULT_MODEL, { input: INPUT, tokensIfUnreported: BY_SIZE }), {
    modelReply: reply,
    tokens: { input: 300, output: 12 },
  });
});

test("a reply that doesn't say what it used is counted by size: what the model read, and what came back", async () => {
  const reply = wrote("Alex is an engineer.");
  const { tokens } = await callModel(writer(reply).ai, DEFAULT_MODEL, { input: INPUT, tokensIfUnreported: BY_SIZE });
  assert.deepEqual(tokens, { input: estimateJsonTokens(INPUT), output: estimateJsonTokens(reply) });
});

test("a call the clock cuts off resolves to no reply, and is counted as if it wrote all it may", async () => {
  const call = { input: INPUT, timeoutMs: SOON_MS, tokensIfUnreported: BY_SIZE };
  assert.deepEqual(await callModel(NEVER, DEFAULT_MODEL, call), {
    modelReply: undefined,
    tokens: { input: estimateJsonTokens(INPUT), output: BY_SIZE.maxOutputTokens },
  });
});

test("with no time limit a call is never counted as cut off, whatever it resolves to", async () => {
  const { tokens } = await callModel(writer(undefined).ai, DEFAULT_MODEL, {
    input: INPUT,
    tokensIfUnreported: BY_SIZE,
  });
  assert.deepEqual(tokens, { input: estimateJsonTokens(INPUT), output: 0 });
});

test("a count the caller assumes stands for a reply that doesn't say what it used, and for one that never came", async () => {
  const assumed = { input: 250, output: 10 };
  for (const [ai, timeoutMs] of [
    [writer(wrote("safe")).ai, undefined],
    [NEVER, SOON_MS],
  ] as const) {
    const { tokens } = await callModel(ai, DEFAULT_MODEL, { input: INPUT, timeoutMs, tokensIfUnreported: assumed });
    assert.deepEqual(tokens, assumed, `time limit: ${timeoutMs}`);
  }
});

test("a model that can't be run rejects: its caller says what that comes to", async () => {
  const { ai } = writer(new Error("3040: capacity"));
  await assert.rejects(callModel(ai, DEFAULT_MODEL, { input: INPUT, tokensIfUnreported: BY_SIZE }), /3040/);
});

test("a call for a line of text sends the prompt, what keeps the model's reasoning off, and the most it may write", async () => {
  const { ai, sent } = writer(wrote("Alex."));
  await callForText(ai, DEFAULT_MODEL, PROMPT, { maxTokens: 40, timeoutMs: 1000 });
  assert.deepEqual(sent, [{ ...PROMPT, ...reasoningOptionsOf(DEFAULT_MODEL), max_completion_tokens: 40 }]);
});

test("a call for text is counted by the size of its prompt, and cut off, as if it wrote all it may", async () => {
  assert.deepEqual(await callForText(NEVER, DEFAULT_MODEL, PROMPT, { maxTokens: 40, timeoutMs: SOON_MS }), {
    modelReply: undefined,
    tokens: { input: estimateJsonTokens(PROMPT), output: 40 },
  });
});

test("tokensUsed reads what a reply says its call used, by either pair of names, or nothing", () => {
  assert.deepEqual(tokensUsed({ usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 } }), {
    input: 12,
    output: 3,
  });
  assert.deepEqual(tokensUsed({ usage: { input_tokens: 7, output_tokens: 0 } }), { input: 7, output: 0 });
  for (const reply of [
    {},
    null,
    "text",
    { usage: null },
    { usage: { prompt_tokens: 12 } },
    { usage: { prompt_tokens: "12", completion_tokens: 3 } },
    { usage: { prompt_tokens: -1, completion_tokens: 3 } },
  ]) {
    assert.equal(tokensUsed(reply), undefined, JSON.stringify(reply));
  }
});
