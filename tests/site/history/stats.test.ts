/* The stats' numbers (src/site/history/stats.ts): what the history comes
   to, since when, its longest streak and its busiest day. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { busiestDay, historyStats, longestStreak } from "../../../src/site/history/stats.ts";
import { sampleHistory } from "../../sample/github-history.ts";
import { everyDayOf, madeUp } from "./made-up.ts";

test("the longest streak is the most days in a row with a contribution, with its first day and its last", () => {
  assert.deepEqual(longestStreak(madeUp({ 2020: [1, 0, 2, 3, 4, 0, 1, 1] })), {
    days: 3,
    from: "2020-01-03",
    to: "2020-01-05",
  });
});

test("a streak runs on from one year into the next", () => {
  const lastTwoDays = everyDayOf(2019, 0).map((count, index, days) => (index >= days.length - 2 ? 1 : count));
  assert.deepEqual(longestStreak(madeUp({ 2019: lastTwoDays, 2020: [5, 5, 5, 0, 1] })), {
    days: 5,
    from: "2019-12-30",
    to: "2020-01-03",
  });
});

test("of two streaks as long, the first is the longest", () => {
  assert.equal(longestStreak(madeUp({ 2020: [1, 1, 0, 9, 9] }))?.from, "2020-01-01");
});

test("the busiest day is the one with the most, the first of several as busy", () => {
  assert.deepEqual(busiestDay(madeUp({ 2020: [1, 7, 0, 7, 2] })), { day: "2020-01-02", count: 7 });
});

test("a history with nothing done has no streak and no busiest day, and counts none", () => {
  const nothing = madeUp({ 2020: [0, 0, 0] });
  assert.deepEqual(historyStats(nothing), {
    total: 0,
    restricted: 0,
    since: 2020,
    streak: undefined,
    busiest: undefined,
  });
});

test("the stats count what GitHub totals each year, private work among it, since the first year", () => {
  const history = madeUp({ 2021: [1, 2], 2022: [3] });
  history.years[0] = { ...history.years[0]!, total: 10, restricted: 4 };
  const { total, restricted, since } = historyStats(history);
  assert.deepEqual({ total, restricted, since }, { total: 13, restricted: 4, since: 2021 });
});

test("the sample's stats are its fixture's: some of it private, a long run in an autumn and a hackathon's Saturday", async () => {
  assert.deepEqual(historyStats(await sampleHistory()), {
    total: 5002,
    restricted: 1099,
    since: 2019,
    streak: { days: 41, from: "2023-10-02", to: "2023-11-11" },
    busiest: { day: "2023-03-18", count: 31 },
  });
});
