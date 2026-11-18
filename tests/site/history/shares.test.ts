/* The languages' shares and the rhythm's (src/site/history/shares.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  busiestWeekday,
  languageShares,
  TOP_LANGUAGES,
  weekdayShares,
  weekdayTotals,
} from "../../../src/site/history/shares.ts";
import { madeUp } from "./made-up.ts";

const withLanguages = (...sizes: Array<[string, number]>) =>
  madeUp({ 2020: [1] }, { languages: sizes.map(([name, size]) => ({ name, size })) });

test(`the ${TOP_LANGUAGES} languages written most have a bar each, the most first, and the rest share one`, () => {
  const shares = languageShares(
    withLanguages(["TypeScript", 50], ["Go", 20], ["Python", 10], ["Rust", 8], ["CSS", 4], ["Shell", 5], ["Ruby", 3]),
  );
  assert.deepEqual(
    shares.map(({ name, size }) => [name, size]),
    [
      ["TypeScript", 50],
      ["Go", 20],
      ["Python", 10],
      ["Rust", 8],
      ["CSS", 4],
      [null, 8],
    ],
  );
  assert.equal(shares[0]?.share, 0.5);
});

test("with no more languages than have a bar each, there's no bar for the rest", () => {
  assert.deepEqual(
    languageShares(withLanguages(["TypeScript", 3], ["CSS", 1])).map(({ name, share }) => [name, share]),
    [
      ["TypeScript", 0.75],
      ["CSS", 0.25],
    ],
  );
});

test("a history with no code in its public repos has no languages", () => {
  assert.deepEqual(languageShares(withLanguages()), []);
  assert.deepEqual(languageShares(withLanguages(["Markdown", 0])), []);
});

test("each day of the week's contributions are counted, Sunday's first", () => {
  // January 1, 2023 was a Sunday.
  const history = madeUp({ 2023: [1, 2, 0, 0, 0, 0, 3, 4] });
  assert.deepEqual(weekdayTotals(history), [5, 2, 0, 0, 0, 0, 3]);
  assert.deepEqual(weekdayShares(history), [0.5, 0.2, 0, 0, 0, 0, 0.3]);
});

test("the busiest day of the week has the most, the first by Date's numbers of two as busy; none, with nothing done", () => {
  assert.equal(busiestWeekday([0.1, 0.3, 0.3, 0.3, 0, 0, 0]), 1);
  assert.equal(busiestWeekday(weekdayShares(madeUp({ 2023: [0, 0] }))), undefined);
});
