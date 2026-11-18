/* The history as a page's language writes it (src/site/history/words.ts):
   from the platform, never from the config's strings. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  daysInPieces,
  firstDayOfWeek,
  weekdayName,
  weekInOrder,
  writtenDay,
  writtenMonth,
  writtenNumber,
  writtenShare,
  writtenSpan,
} from "../../../src/site/history/words.ts";

test("a week starts where the page's language starts it: Sunday in English and Japanese, Monday in French", () => {
  assert.deepEqual(["en", "ja", "fr", "en-GB"].map(firstDayOfWeek), [0, 0, 1, 1]);
  assert.deepEqual(weekInOrder("fr"), [1, 2, 3, 4, 5, 6, 0]);
  assert.deepEqual(
    weekInOrder("en").map((weekday) => weekdayName("en", weekday)),
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  );
  assert.equal(weekdayName("ja", 3), "水");
});

test("a count of days comes in pieces, the figures apart from the word", () => {
  assert.deepEqual(daysInPieces("en", 23), [
    { text: "23", isNumber: true },
    { text: " ", isNumber: false },
    { text: "days", isNumber: false },
  ]);
  assert.deepEqual(daysInPieces("en", 1).at(-1), { text: "day", isNumber: false });
  assert.equal(
    daysInPieces("ja", 1_204)
      .map((piece) => piece.text)
      .join(""),
    "1,204 日",
  );
});

test("numbers and shares are the language's own: a share too small to be whole has a decimal", () => {
  assert.deepEqual([writtenNumber("en", 4812), writtenNumber("fr", 4812)], ["4,812", "4 812"]);
  assert.deepEqual([writtenShare("en", 0.5), writtenShare("en", 0.004), writtenShare("en", 0)], ["50%", "0.4%", "0%"]);
});

test("a day is GitHub's UTC day, written in the page's language", () => {
  assert.equal(writtenDay("en", "2023-03-18"), "Mar 18, 2023");
  assert.equal(writtenDay("ja", "2023-03-18"), "2023/03/18");
  assert.equal(writtenSpan("en", "2023-10-02", "2023-11-11"), "Oct 2\u2009–\u2009Nov 11, 2023");
  assert.equal(writtenMonth("en", "2022-04"), "April 2022");
});
