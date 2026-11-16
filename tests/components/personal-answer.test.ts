/* src/components/personal-answer.ts: a personal answer's lines, as its tab
   shows them. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { answerLine, isEmojiList } from "../../src/components/personal-answer.ts";

test("an emoji a line starts with is apart from its words, without the space between", () => {
  assert.deepEqual(answerLine("🎸 Plays **guitar**"), { emoji: "🎸", text: "Plays **guitar**" });
});

test("an emoji keeps the selector that asks for its emoji form", () => {
  assert.deepEqual(answerLine("☕️ Black"), { emoji: "☕️", text: "Black" });
});

test("a line that doesn't start with an emoji is its words alone, an emoji later in it among them", () => {
  assert.deepEqual(answerLine("Ramen 🍜, of course"), { text: "Ramen 🍜, of course" });
});

test("a list whose every line starts with an emoji has them for bullets", () => {
  assert.equal(isEmojiList(["🎸 Guitar", "📚 Books"]), true);
});

test("a list with one line that doesn't start with an emoji keeps its bullets", () => {
  assert.equal(isEmojiList(["🎸 Guitar", "Books"]), false);
});
