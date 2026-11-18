/* A GitHub user's whole history of contributions, as the build keeps it:
   only what the parts of it draw (src/components/GitHubPart.astro). The
   build fetches it (queries.ts), then gives the pages it in place of
   fetched.ts (src/integrations/history.ts). Days are GitHub's, in UTC, and
   written "2019-03-11". */

/** One year of the history. */
export type HistoryYear = {
  /** 2019. */
  year: number;
  /** Its contributions, as GitHub totals them: private ones it counts are
      among them. */
  total: number;
  /** How many of them GitHub counts but doesn't show: work in private
      repos, on a profile set to count it. */
  restricted: number;
  /** Each day's contributions, January 1's first: to December 31, or in
      the year the build asked, to that day. */
  days: number[];
};

/** A language of the user's public repos, and how much is written in it. */
export type LanguageSize = {
  /** As GitHub names it: "TypeScript". */
  name: string;
  /** In bytes, across the repos. */
  size: number;
};

export type History = {
  /** When the account was made, in UTC: "2019-09-16T08:12:40Z". The
      calendar has no weeks before it. */
  createdAt: string;
  /** The last day the history has: the day the build asked GitHub, as
      GitHub's calendar had it. */
  asOf: string;
  /** A year each, oldest first, from the first with a contribution to the
      last. */
  years: HistoryYear[];
  /** The languages of the user's own public repos, not forks, the most
      written first. */
  languages: LanguageSize[];
};

const MS_A_DAY = 86_400_000;

/** "YYYY-MM-DD": as many characters as a day has. */
const DAY_LENGTH = "YYYY-MM-DD".length;

/** The day of a moment, in UTC: "2019-09-16" for "2019-09-16T08:12:40Z". */
export const dayOf = (moment: string | Date): string =>
  (typeof moment === "string" ? new Date(moment) : moment).toISOString().slice(0, DAY_LENGTH);

const yearOf = (day: string): number => Number(day.slice(0, "YYYY".length));

/** A day's place in its year: 0 for January 1. */
export const dayOfYear = (day: string): number => (Date.parse(day) - Date.UTC(yearOf(day), 0, 1)) / MS_A_DAY;

/** The day `index` days after January 1 of `year`: "2019-03-11". */
export const dayIn = (year: number, index: number): string => dayOf(new Date(Date.UTC(year, 0, 1 + index)));

/** 365, or 366. */
export const daysInYear = (year: number): number => (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / MS_A_DAY;

/** The day of the week, as Date has it: 0 for Sunday. */
export const weekdayOf = (day: string): number => new Date(day).getUTCDay();

/** A day of the history, with what was done on it. */
export type Day = { day: string; count: number };

/** Every day the history has, in order, from January 1 of its first year
    to the day it was asked. */
export const everyDay = ({ years }: History): Day[] =>
  years.flatMap(({ year, days }) => days.map((count, index) => ({ day: dayIn(year, index), count })));
