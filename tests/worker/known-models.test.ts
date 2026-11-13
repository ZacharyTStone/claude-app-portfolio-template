/* The models Ask has been run with, and their prices
   (src/worker/ask/known-models.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { KNOWN_MODELS, LLAMA_GUARD_MODEL, UNLISTED_MODEL_PRICE } from "../../src/worker/ask/known-models.ts";

test("a model that isn't listed is counted at no less than any picker that is, so the budget stops early", () => {
  for (const [model, { price }] of KNOWN_MODELS) {
    assert.ok(
      price.input <= UNLISTED_MODEL_PRICE.input || model === LLAMA_GUARD_MODEL,
      `${model} reads for no more than a model not listed`,
    );
    assert.ok(price.output <= UNLISTED_MODEL_PRICE.output, `${model} writes for no more than a model not listed`);
  }
});
