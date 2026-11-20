/* The words no question needs (src/worker/ask/crude.ts): English ones are
   matched whole, Japanese ones anywhere, each after NFKC. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isCrude } from "../../src/worker/ask/crude.ts";

test("a question with a word on the list is crude, in any case, alone or in a sentence", () => {
  for (const question of ["penis", "PENIS?", "Is he sexy", "what the fuck is this", "ちんこ", "彼はキチガイ？"]) {
    assert.equal(isCrude(question), true, question);
  }
});

test("an English word is matched whole: one inside another word, or an innocent phrase, isn't crude", () => {
  for (const question of [
    "Has he read Dickens?",
    "Is he from Scunthorpe?",
    "Does he like peacocks or cocktails?",
    "Did he graduate cum laude?",
    "Does he set up naked domains?",
    "Is the app unisex?",
    "What does he think of grapes?",
  ]) {
    assert.equal(isCrude(question), false, question);
  }
});

test("full-width letters and half-width kana count as what they are", () => {
  assert.equal(isCrude("ｐｅｎｉｓ"), true);
  assert.equal(isCrude("ﾁﾝｺ"), true);
});

test("a question about the owner's work is not crude", () => {
  for (const question of ["What's his stack?", "日本語はどのくらいできるの？", "Does he do CI/CD?"]) {
    assert.equal(isCrude(question), false, question);
  }
});
