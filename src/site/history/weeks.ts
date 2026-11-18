/* The calendar part's rows, worked out from the history: a row a year,
   oldest first, each a strip of weeks shaded by how much was done in
   them, with the moments the config names (its marks) at their weeks.

   A row's weeks start on January 1, so a column is the same days of the
   year in every row: the years compare week for week, and a month is at
   the same place in each. The last week takes the year's last day or two
   as well, rather than leave a stub that would read as a quiet week.
   The public repos the config shows are placed the same way, each at the
   week it was made. */
import { sum } from "es-toolkit";
import type { HistoryMark } from "../../config/github-history.ts";
import {
  dayIn,
  dayOf,
  dayOfYear,
  daysInYear,
  everyDay,
  type History,
  type HistoryYear,
  type PublicRepo,
} from "./history.ts";

/** The columns of a row. */
export const WEEKS_A_ROW = 52;

const DAYS_A_WEEK = 7;

/** The shades a week can have: 0 for none done, then 1 to 4. */
export const LEVELS = [0, 1, 2, 3, 4] as const;

export type Level = (typeof LEVELS)[number];

/** The shares of the history's busy weeks below each shade's top: a
    quarter of them in each of the four shades. */
const QUARTILES = [0.25, 0.5, 0.75];

export type Week = {
  /** Its first day and its last, of those the history has. */
  from: string;
  to: string;
  /** The contributions on those days. */
  count: number;
  level: Level;
};

/** A mark, at the column of the week its month starts in. */
export type PlacedMark = HistoryMark & {
  week: number;
  /** In the second half of the row: its name is written to the left of
      its tick, so that it stays within the row. */
  late: boolean;
};

/** A public repo, at the column of the week it was made. */
export type PlacedRepo = PublicRepo & { week: number };

export type CalendarRow = {
  year: number;
  /** The year's contributions, as GitHub totals them. */
  total: number;
  /** A place for each column, undefined where the history has no week:
      before the account and its first contribution, or after the day the
      build asked. */
  weeks: Array<Week | undefined>;
  marks: PlacedMark[];
  /** The repos made in the year, the oldest first. */
  repos: PlacedRepo[];
};

/** The history's first day: the day the account was made, or the day of
    an earlier contribution (a commit can be dated before the account). */
function firstDayOf(history: History): string {
  const firstDone = everyDay(history).find((day) => day.count > 0)?.day;
  const made = dayOf(history.createdAt);
  return firstDone !== undefined && firstDone < made ? firstDone : made;
}

type Span = { first: string; last: string };

/** A row's weeks, each undefined if none of its days is in `span`. */
function weeksOfYear({ year, days }: HistoryYear, span: Span): Array<Omit<Week, "level"> | undefined> {
  return Array.from({ length: WEEKS_A_ROW }, (_, week) => {
    const lastIndex = week === WEEKS_A_ROW - 1 ? daysInYear(year) - 1 : (week + 1) * DAYS_A_WEEK - 1;
    const first = dayIn(year, week * DAYS_A_WEEK);
    const from = first > span.first ? first : span.first;
    const last = dayIn(year, lastIndex);
    const to = last < span.last ? last : span.last;
    if (from > to) return undefined;
    return { from, to, count: sum(days.slice(dayOfYear(from), dayOfYear(to) + 1)) };
  });
}

/** The tops of the four shades but the last: a busy week is in the first
    shade up to the first, the second up to the second, and so on. Taken
    from every busy week of the history, so that the years compare. */
export function shadeTops(counts: number[]): number[] {
  const busy = counts.filter((count) => count > 0).sort((one, other) => one - other);
  if (!busy.length) return [];
  return QUARTILES.map((share) => busy[Math.ceil(share * busy.length) - 1] ?? 0);
}

/** A week's shade: 0 for none done; else 1, and one more for each top it's over. */
export const levelOf = (count: number, tops: number[]): Level =>
  count === 0 ? 0 : ((1 + tops.filter((top) => count > top).length) as Level);

const yearOfMonth = (month: string): number => Number(month.slice(0, "YYYY".length));

/** The column of the week a day is in. */
const weekOf = (day: string): number => Math.min(WEEKS_A_ROW - 1, Math.floor(dayOfYear(day) / DAYS_A_WEEK));

/** Where a mark goes in its year's row. */
function placed(mark: HistoryMark): PlacedMark {
  const week = weekOf(`${mark.at}-01`);
  return { ...mark, week, late: week >= WEEKS_A_ROW / 2 };
}

/** The marks in no year of the history: the calendar has nowhere to put
    them. */
export const marksOffTheTimeline = (history: History, marks: HistoryMark[] = []): HistoryMark[] =>
  marks.filter((mark) => !history.years.some(({ year }) => year === yearOfMonth(mark.at)));

/** A row for each year of the history, oldest first, with `marks` and
    `repos` at their weeks. A repo made in a year the history doesn't have
    (one made before the first contribution) has no row to go in. */
export function calendarRows(history: History, marks: HistoryMark[] = [], repos: PublicRepo[] = []): CalendarRow[] {
  const span = { first: firstDayOf(history), last: history.asOf };
  const weeksByYear = history.years.map((year) => weeksOfYear(year, span));
  const tops = shadeTops(weeksByYear.flat().map((week) => week?.count ?? 0));
  return history.years.map(({ year, total }, at) => ({
    year,
    total,
    weeks: (weeksByYear[at] ?? []).map((week) => week && { ...week, level: levelOf(week.count, tops) }),
    marks: marks
      .filter((mark) => yearOfMonth(mark.at) === year)
      .map(placed)
      .sort((one, other) => one.week - other.week),
    repos: repos
      .filter((repo) => yearOfMonth(repo.madeOn) === year)
      .map((repo) => ({ ...repo, week: weekOf(repo.madeOn) })),
  }));
}
