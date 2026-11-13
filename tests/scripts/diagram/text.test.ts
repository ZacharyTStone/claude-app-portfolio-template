import assert from "node:assert/strict";
import { test } from "node:test";
import { sizeToFit, textWidth } from "../../../scripts/diagram.ts";

const WORDS = "A line of some words";
const SIZE = 40;
const regular = textWidth(WORDS, SIZE);

test("Semibold text is counted wider than regular", () => {
  assert.ok(textWidth(WORDS, SIZE, { weight: 600 }) > regular);
});

test("Medium text is counted as regular", () => {
  assert.equal(textWidth(WORDS, SIZE, { weight: 500 }), regular);
});

test("A monospaced font's bold is no wider", () => {
  assert.equal(textWidth(WORDS, SIZE, { mono: true, weight: 600 }), textWidth(WORDS, SIZE, { mono: true }));
});

test("Text that fits keeps its size", () => {
  assert.equal(sizeToFit(WORDS, regular + 1, SIZE), SIZE);
});

test("Text too wide is written as much smaller as it takes to fit", () => {
  const smaller = sizeToFit(WORDS, regular / 2, SIZE);
  assert.equal(smaller, 20);
  assert.ok(textWidth(WORDS, smaller) <= regular / 2, "at the smaller size it fits");
});

test("Bold text has to be smaller still to fit", () => {
  assert.ok(sizeToFit(WORDS, regular / 2, SIZE, { weight: 600 }) < sizeToFit(WORDS, regular / 2, SIZE));
});
