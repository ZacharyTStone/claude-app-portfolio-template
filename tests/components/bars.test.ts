/* How long a bar is drawn (src/site/bars.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { barLength } from "../../src/site/bars.ts";

test("the longest bar leaves room for its value", () => {
  assert.equal(barLength(1040, 1040), 70);
});

test("a bar is as long as its amount, beside the longest", () => {
  assert.equal(barLength(385, 1040), 25.91);
});
