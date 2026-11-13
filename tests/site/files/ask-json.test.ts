/* ask.json, as the build writes it for the sample site (src/site/files/ask-json.ts).
   tests/sample/ask-answers.test.ts holds every line of the sample's answers. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AskIndex } from "../../../src/contracts/ask.ts";
import { askIndexJson } from "../../../src/site/files/ask-json.ts";
import { makeSite } from "../../../src/site/site.ts";
import { sampleConfig } from "../sample.ts";

/** The sample's ask.json with Ask on, read back from the file's text. */
const index = JSON.parse(
  askIndexJson(makeSite(sampleConfig({ host: "cloudflare", ask: { role: "an engineer" } }))),
) as AskIndex;
const englishAnswers = index.answers.en ?? [];
const workAnswerLines = (englishAnswers.find((answer) => answer.id === "work.1")?.text ?? "").split("\n");

test("ask.json says whose site it is, in each language, and which language is the main one", () => {
  const { answers: _answers, ...whoseSite } = index;
  assert.deepEqual(whoseSite, {
    name: "Sam Sample",
    names: { en: "Sam Sample", fr: "Sam Sample" },
    role: "an engineer",
    main: "en",
  });
});

test("ask.json has every language's answers", () => {
  assert.deepEqual(Object.keys(index.answers), ["en", "fr"]);
});

for (const line of [
  "Time to load: Before 1.04 s, After 385 ms (63% faster)",
  "The pipeline: Draft (by hand) → Publish",
  "“Sam got it done.” (A coworker)",
  "The icon:",
]) {
  test(`a figure's, a quote's or a heading's words are a line of the answer: "${line}"`, () => {
    assert.ok(workAnswerLines.includes(line), workAnswerLines.join("\n"));
  });
}

test("a card's rows are each a line of an answer, never two on one, so Ask can quote one", () => {
  const twoRowsOnALine = /^\w+: [^\n]*; \w+: /m;
  assert.deepEqual(
    englishAnswers.filter(({ text }) => twoRowsOnALine.test(text)),
    [],
  );
});
