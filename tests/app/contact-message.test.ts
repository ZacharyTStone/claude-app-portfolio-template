import assert from "node:assert/strict";
import { test } from "node:test";
import { messageWithQuestion } from "../../src/app/contact-message.ts";
import { MAX_MESSAGE_LENGTH } from "../../src/contracts/contact.ts";

const QUESTION = "Do you know testing?";

for (const [what, typed] of [
  ["an empty box", ""],
  ["a box of spaces and line breaks", "  \n "],
] as const) {
  test(`${what} gets the question alone`, () => {
    assert.equal(messageWithQuestion(typed, QUESTION), QUESTION);
  });
}

test("what the visitor typed stays, and the question goes after it, on a paragraph of its own", () => {
  assert.equal(messageWithQuestion("Hi Sam,\n", QUESTION), `Hi Sam,\n\n${QUESTION}`);
});

test("a box that has the question already is left as it is, so a second click adds nothing", () => {
  const once = messageWithQuestion("Hi Sam,", QUESTION);
  assert.equal(messageWithQuestion(once, QUESTION), once);
});

test("a box without room for the question too is left as it is", () => {
  const full = "x".repeat(MAX_MESSAGE_LENGTH - QUESTION.length);
  assert.equal(messageWithQuestion(full, QUESTION), full);
  const justRoom = "x".repeat(MAX_MESSAGE_LENGTH - QUESTION.length - 2);
  assert.equal(messageWithQuestion(justRoom, QUESTION).length, MAX_MESSAGE_LENGTH);
});

test("no question leaves what was typed as it is", () => {
  assert.equal(messageWithQuestion("Hi Sam,", ""), "Hi Sam,");
});
