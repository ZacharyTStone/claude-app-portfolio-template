/* What /ask accepts, and how it replies: a JSON POST of at most
   MAX_REQUEST_BYTES with a question in it, answered with JSON that's never
   cached; anything else is turned away before the model is asked. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_QUESTION_LENGTH, MAX_REQUEST_BYTES } from "../../src/contracts/ask.ts";
import { ask, askJson, firstCall, send, stubs } from "./fixtures.ts";

test("turned off, it doesn't call the model", async () => {
  for (const ASK_ENABLED of ["false", "TRUE", ""]) {
    const { env, calls } = stubs({ vars: { ASK_ENABLED } });
    assert.deepEqual(await askJson(env, "who?"), { id: null, why: "off" });
    assert.equal(calls.length, 0);
  }
});

test("a request over MAX_REQUEST_BYTES is turned away, counted in bytes, by Content-Length or as it comes", async () => {
  const { env, calls } = stubs();
  assert.equal((await ask(env, { question: "hi", padding: "x".repeat(MAX_REQUEST_BYTES) })).status, 413);
  // A third as many characters, but three bytes each in UTF-8.
  assert.equal((await ask(env, { question: "あ".repeat(MAX_REQUEST_BYTES / 3 + 1), lang: "ja" })).status, 413);
  const declared = { headers: { "Content-Length": String(MAX_REQUEST_BYTES + 1) } };
  assert.equal((await ask(env, { question: "hi", lang: "en" }, declared)).status, 413);
  assert.equal(calls.length, 0);
});

test("a body with no Content-Length is read no further than MAX_REQUEST_BYTES", async () => {
  const { env, calls } = stubs();
  const chunk = new TextEncoder().encode("x".repeat(1024));
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled++;
      if (pulled > 1000) controller.close();
      else controller.enqueue(chunk);
    },
  });
  const request = new Request("https://site.example/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit);
  assert.equal((await send(env, request)).status, 413);
  assert.ok(pulled <= MAX_REQUEST_BYTES / chunk.byteLength + 2, `read ${pulled} KB`);
  assert.equal(calls.length, 0);
});

test("only a JSON POST with a question is accepted", async () => {
  const { env, calls } = stubs();
  assert.equal((await ask(env, null, { method: "GET" })).status, 405);
  assert.equal((await ask(env, "question=hi", { type: "application/x-www-form-urlencoded" })).status, 415);
  assert.equal((await ask(env, "{not json")).status, 400);
  assert.equal((await ask(env, { question: "   " })).status, 400);
  assert.equal(calls.length, 0);
});

test("replies are JSON, never cached or sniffed", async () => {
  const { env } = stubs();
  const refused = await ask(env, null, { method: "GET" });
  assert.equal(refused.headers.get("Allow"), "POST");
  for (const response of [refused, await ask(env, { question: "who?", lang: "en" })]) {
    assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  }
});

test("a longer question (inside MAX_REQUEST_BYTES) is cut to MAX_QUESTION_LENGTH", async () => {
  const { env, calls } = stubs();
  await askJson(env, "x".repeat(MAX_QUESTION_LENGTH * 2));
  assert.equal(firstCall(calls).input.messages.at(-1)?.content.length, MAX_QUESTION_LENGTH);
});

test("other paths go to the static files", async () => {
  const { env } = stubs();
  const response = await ask(env, null, { method: "GET", url: "https://site.example/nothing-here" });
  assert.equal(await response.text(), "a static file");
});
