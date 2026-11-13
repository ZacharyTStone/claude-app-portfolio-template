/* src/app/question-card/keys.ts: what a key pressed in the question card
   does, outside its box. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { actionForKey, type CardKeyAction } from "../../src/app/question-card/keys.ts";

const ON_THE_TOPICS = false;
const ON_A_TOPICS_TABS = true;

const KEYS: Record<string, { key: string; action: CardKeyAction | null }> = {
  "a letter is typed into the box": { key: "d", action: { kind: "type", character: "d" } },
  "a capital is typed into the box": { key: "D", action: { kind: "type", character: "D" } },
  "a character of another script is typed into the box": { key: "あ", action: { kind: "type", character: "あ" } },
  "a question mark is typed into the box": { key: "?", action: { kind: "type", character: "?" } },
  "a zero is typed into the box: no choice has that number": { key: "0", action: { kind: "type", character: "0" } },
  "a choice's number picks it": { key: "3", action: { kind: "pick", choiceNumber: 3 } },
  "the first number picks the first choice": { key: "1", action: { kind: "pick", choiceNumber: 1 } },
  "the last number picks the ninth choice": { key: "9", action: { kind: "pick", choiceNumber: 9 } },
  "the down arrow moves focus on": { key: "ArrowDown", action: { kind: "moveFocus", by: 1 } },
  "the up arrow moves focus back": { key: "ArrowUp", action: { kind: "moveFocus", by: -1 } },
  "the space is left to the choice that has focus": { key: " ", action: null },
  "Enter is left to the choice that has focus": { key: "Enter", action: null },
  "Escape is left to what closes the card": { key: "Escape", action: null },
  "Tab is left to the browser": { key: "Tab", action: null },
  "the right arrow does nothing": { key: "ArrowRight", action: null },
};

for (const [what, { key, action }] of Object.entries(KEYS)) {
  test(`in the question card, ${what}`, () => {
    assert.deepEqual(actionForKey(key, ON_THE_TOPICS), action);
  });
}

test("the left arrow goes back from a topic's tabs to the topics", () => {
  assert.deepEqual(actionForKey("ArrowLeft", ON_A_TOPICS_TABS), { kind: "back" });
});

test("on the topics, the left arrow has nowhere to go back to", () => {
  assert.equal(actionForKey("ArrowLeft", ON_THE_TOPICS), null);
});
