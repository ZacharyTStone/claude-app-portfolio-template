/* The calendar's rows (src/site/history/weeks.ts): a row a year of 52
   weeks from January 1, shaded by quarters of every busy week, with the
   config's marks at their weeks. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calendarRows,
  levelOf,
  marksOffTheTimeline,
  shadeTops,
  WEEKS_A_ROW,
  type Week,
} from "../../../src/site/history/weeks.ts";
import { everyDayOf, madeUp } from "./made-up.ts";

const firstRow = (...args: Parameters<typeof calendarRows>) => {
  const [row] = calendarRows(...args);
  assert.ok(row, "the history has a row");
  return row;
};

test("the shades' tops are the quarters of the busy weeks, the weeks with nothing done left out", () => {
  assert.deepEqual(shadeTops([0, 4, 1, 0, 2, 3, 8, 5, 6, 7]), [2, 4, 6]);
  assert.deepEqual(shadeTops([0, 0]), []);
});

test("a week with nothing done has the palest shade, and each top it's over makes it one stronger", () => {
  const tops = [2, 4, 6];
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7, 99].map((count) => levelOf(count, tops)),
    [0, 1, 1, 2, 2, 3, 3, 4, 4],
  );
});

test("a row has 52 weeks from January 1, the last taking the year's last 8 days", () => {
  const { weeks } = firstRow(madeUp({ 2019: everyDayOf(2019, 1) }));
  assert.equal(weeks.length, WEEKS_A_ROW);
  assert.deepEqual(weeks[0], { from: "2019-01-01", to: "2019-01-07", count: 7, level: 1 });
  assert.deepEqual(weeks.at(-1), { from: "2019-12-24", to: "2019-12-31", count: 8, level: 4 });
});

test("in a leap year, the last week takes the year's last 9 days", () => {
  const { weeks } = firstRow(madeUp({ 2020: everyDayOf(2020, 1) }));
  assert.deepEqual([weeks.at(-1)?.from, weeks.at(-1)?.to, weeks.at(-1)?.count], ["2020-12-23", "2020-12-31", 9]);
});

test("weeks before the account was made, and after the day the build asked, have no place", () => {
  const history = madeUp({ 2021: everyDayOf(2021, 0).slice(0, 100) }, { createdAt: "2021-01-20T12:00:00Z" });
  const { weeks } = firstRow(history);
  const placed = weeks.flatMap((week, column) => (week ? [column] : []));
  assert.deepEqual([placed[0], placed.at(-1)], [2, 14]);
  assert.deepEqual([weeks[2]?.from, weeks[14]?.to], ["2021-01-20", "2021-04-10"]);
});

test("a contribution dated before the account was made still has its week", () => {
  const days = everyDayOf(2021, 0).map((count, index) => (index === 3 ? 2 : count));
  const { weeks } = firstRow(madeUp({ 2021: days }, { createdAt: "2021-06-01T00:00:00Z" }));
  assert.deepEqual(weeks[0], { from: "2021-01-04", to: "2021-01-07", count: 2, level: 1 });
});

test("the shades are the whole history's, so that a quiet year looks quiet beside a busy one", () => {
  const rows = calendarRows(madeUp({ 2020: everyDayOf(2020, 1), 2021: everyDayOf(2021, 5) }));
  const levels = (weeks: Array<Week | undefined>) => new Set(weeks.map((week) => week?.level));
  assert.deepEqual(levels(rows[0]?.weeks ?? []), new Set([1, 2]));
  assert.deepEqual(levels(rows[1]?.weeks ?? []), new Set([3, 4]));
});

test("each row is a year, oldest first, with GitHub's total for it", () => {
  const history = madeUp({ 2020: [1, 2], 2021: [3] });
  assert.deepEqual(
    calendarRows(history).map(({ year, total }) => [year, total]),
    [
      [2020, 3],
      [2021, 3],
    ],
  );
});

test("a mark is at the week its month starts in, named to the right of its tick in the row's first half and to the left in its second", () => {
  const marks = [
    { at: "2020-11", label: "Later" },
    { at: "2020-01", label: "First" },
    { at: "2020-04", label: "Spring" },
  ];
  assert.deepEqual(firstRow(madeUp({ 2020: everyDayOf(2020, 1) }), marks).marks, [
    { at: "2020-01", label: "First", week: 0, late: false },
    { at: "2020-04", label: "Spring", week: 13, late: false },
    { at: "2020-11", label: "Later", week: 43, late: true },
  ]);
});

test("a mark in a year the history doesn't have is off the timeline, and on no row", () => {
  const history = madeUp({ 2020: [1], 2021: [1] });
  const marks = [
    { at: "2019-05", label: "Before" },
    { at: "2021-05", label: "In it" },
  ];
  assert.deepEqual(marksOffTheTimeline(history, marks), [{ at: "2019-05", label: "Before" }]);
  assert.deepEqual(
    calendarRows(history, marks).flatMap((row) => row.marks.map((mark) => mark.label)),
    ["In it"],
  );
});
