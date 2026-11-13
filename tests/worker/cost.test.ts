/* What a call costs (src/worker/ask/cost.ts): tokens counted by size when
   a model doesn't say what it used, and priced in Neurons. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateJsonTokens, estimateTokens, neuronCost } from "../../src/worker/ask/cost.ts";
import { priceOf, DEFAULT_MODEL } from "../../src/worker/ask/known-models.ts";

const PICKER = priceOf(DEFAULT_MODEL);

test("a text's tokens are counted high: a third of its bytes, so a Japanese character is one", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abc"), 1);
  assert.equal(estimateTokens("abcd"), 2);
  assert.equal(estimateTokens("日本語"), 3);
  assert.equal(estimateJsonTokens({ a: "日本" }), estimateTokens('{"a":"日本"}'));
  assert.equal(estimateJsonTokens(undefined), 0);
});

test("Neurons are tokens at the model's price for a million", () => {
  assert.equal(neuronCost({ input: 1_000_000, output: 0 }, { input: 5500, output: 36400 }), 5500);
  assert.equal(neuronCost({ input: 0, output: 500_000 }, { input: 5500, output: 36400 }), 18200);
  assert.equal(neuronCost({ input: 0, output: 0 }, PICKER), 0);
});
