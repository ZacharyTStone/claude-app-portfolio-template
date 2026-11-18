/* The numbers the stats part shows, worked out from the history: what it
   comes to, since when, the longest run of days with something done, and
   the busiest day. There is no "current streak": the page is built once
   and read for days after, when a streak it called current may be over. */
import { sumBy } from "es-toolkit";
import { everyDay, type Day, type History } from "./history.ts";

/** The most days in a row with a contribution on each. */
export type Streak = {
  /** How many days: 23. */
  days: number;
  /** Its first day and its last: "2023-03-02", "2023-03-24". */
  from: string;
  to: string;
};

export type HistoryStats = {
  /** Every contribution GitHub counts, private ones among them. */
  total: number;
  /** Of those, how many are private: counted, but not shown. */
  restricted: number;
  /** The history's first year: 2019. Undefined for a history of none. */
  since: number | undefined;
  /** Undefined for a history with no contribution in it. */
  streak: Streak | undefined;
  /** The day with the most contributions, the first of them if several
      have as many. Undefined for a history with no contribution in it. */
  busiest: Day | undefined;
};

/** The longest run of days with a contribution on each, the first of
    them if several are as long. */
export function longestStreak(history: History): Streak | undefined {
  const none: Streak = { days: 0, from: "", to: "" };
  let longest = none;
  let current = none;
  for (const { day, count } of everyDay(history)) {
    current = count > 0 ? { days: current.days + 1, from: current.days ? current.from : day, to: day } : none;
    if (current.days > longest.days) longest = current;
  }
  return longest.days ? longest : undefined;
}

/** The day with the most contributions: the first, of several as busy. */
export function busiestDay(history: History): Day | undefined {
  let busiest: Day | undefined;
  for (const day of everyDay(history)) if (day.count > (busiest?.count ?? 0)) busiest = day;
  return busiest;
}

export const historyStats = (history: History): HistoryStats => ({
  total: sumBy(history.years, (year) => year.total),
  restricted: sumBy(history.years, (year) => year.restricted),
  since: history.years[0]?.year,
  streak: longestStreak(history),
  busiest: busiestDay(history),
});
