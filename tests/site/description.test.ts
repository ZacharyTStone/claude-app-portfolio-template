/* A tab's page's description, from its first answer (src/site/description.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Block } from "../../src/config/blocks.ts";
import { describe, LONGEST_DESCRIPTION, shortened } from "../../src/site/description.ts";

const SENTENCE = "Sam builds web apps from the database to the button.";

test("an answer's paragraphs and lists are its description, as plain text on one line", () => {
  assert.equal(
    describe(["Sam is **an engineer**,\nin [Lisbon](#about).", ["Writes `TypeScript`.", "Ships often."]], "en"),
    "Sam is an engineer, in Lisbon. Writes TypeScript. Ships often.",
  );
});

test("an answer's cards and figures say nothing in its description", () => {
  const card: Block = { card: { file: "role.yaml", lines: [["role", "Engineer"]] } };
  assert.equal(describe([card, SENTENCE], "en"), SENTENCE);
});

test("an answer with no words of its own has no description", () => {
  assert.equal(describe([{ quote: { text: "Good.", by: "A coworker" } }], "en"), null);
});

test("Japanese sentences follow one another with no space between", () => {
  assert.equal(
    describe(["サムはエンジニアです。", "東京に住んでいます。"], "ja"),
    "サムはエンジニアです。東京に住んでいます。",
  );
});

test("a description too long is cut after the last sentence that fits", () => {
  const text = Array.from({ length: 6 }, () => SENTENCE).join(" ");
  const cut = shortened(text, "en");
  assert.equal(cut, Array.from({ length: 3 }, () => SENTENCE).join(" "));
  assert.ok(cut.length <= LONGEST_DESCRIPTION);
});

test("a first sentence too long is cut after a word, with an ellipsis", () => {
  const longSentence = `${"Sam builds web apps, ".repeat(12)}and ships them.`;
  const cut = shortened(longSentence, "en");
  assert.ok(cut.length <= LONGEST_DESCRIPTION, `${cut.length} characters`);
  assert.ok(longSentence.startsWith(cut.slice(0, -1)), "it's the sentence's start");
  assert.match(cut, /(builds|web|apps)…$/);
});

test("a cut that would leave a comma before the ellipsis leaves it out", () => {
  const cut = shortened(`${"a".repeat(LONGEST_DESCRIPTION - 3)}, and more`, "en");
  assert.equal(cut, `${"a".repeat(LONGEST_DESCRIPTION - 3)}…`);
});

test("Japanese with no sentence short enough is cut between its words", () => {
  const cut = shortened(`${"サムは東京でウェブアプリを作っています、".repeat(10)}。`, "ja");
  assert.ok(cut.length <= LONGEST_DESCRIPTION, `${cut.length} characters`);
  assert.match(cut, /います…$/);
});

test("a word longer than a whole description is cut where the description ends", () => {
  const cut = shortened("x".repeat(LONGEST_DESCRIPTION * 2), "en");
  assert.equal(cut, `${"x".repeat(LONGEST_DESCRIPTION - 1)}…`);
});
