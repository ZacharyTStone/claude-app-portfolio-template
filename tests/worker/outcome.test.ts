/* What the visitor is told of what came of their question
   (src/worker/ask/outcome.ts): JSON that's never cached, and how many
   questions they have left once that's few. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { WARN_AT_QUESTIONS_LEFT } from "../../src/worker/ask/outcome.ts";
import { okLeft } from "./support/guard.ts";
import { models, toolCall } from "./support/models.ts";
import { stubs } from "./support/worker.ts";

test("replies are JSON, never cached or sniffed", async () => {
  const { ask } = stubs();
  const refused = await ask(null, { method: "GET" });
  assert.equal(refused.headers.get("Allow"), "POST");
  for (const response of [refused, await ask({ question: "who?", lang: "en" })]) {
    assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  }
});

test("with WARN_AT_QUESTIONS_LEFT questions left or fewer, the reply says how many", async () => {
  for (const [left, said] of [
    [WARN_AT_QUESTIONS_LEFT, { id: "skills.1", left: WARN_AT_QUESTIONS_LEFT }],
    [WARN_AT_QUESTIONS_LEFT + 1, { id: "skills.1" }],
  ] as const) {
    const { askJson } = stubs({ run: models(toolCall("skills.1")), guardSays: okLeft(left) });
    assert.deepEqual(await askJson("Postgres?"), said);
  }
});

test("a small visitor's limit is warned about near its end, not from its start: at a third left", async () => {
  for (const [limit, left, said] of [
    ["12", 4, { id: "skills.1", left: 4 }],
    ["12", 5, { id: "skills.1" }],
    ["2", 1, { id: "skills.1" }],
    ["2", 0, { id: "skills.1", left: 0 }],
  ] as const) {
    const { askJson } = stubs({
      run: models(toolCall("skills.1")),
      guardSays: okLeft(left),
      vars: { ASK_VISITOR_LIMIT: limit },
    });
    assert.deepEqual(await askJson("Postgres?"), said, `${left} left of ${limit}`);
  }
});
