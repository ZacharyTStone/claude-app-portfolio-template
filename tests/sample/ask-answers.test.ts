import assert from "node:assert/strict";
import { test } from "node:test";
import { plainAnswers } from "../../src/site/plain-answers.ts";
import { makeSite } from "../../src/site/site.ts";
import { SAMPLE_ANSWERS } from "./ask-answers.ts";
import sampleConfig from "./site.config.ts";

test("the sample site's answers, as the Worker's tests read them, are what the build writes to /ask.json", () => {
  assert.deepEqual(plainAnswers(makeSite(sampleConfig), "en"), SAMPLE_ANSWERS);
});
