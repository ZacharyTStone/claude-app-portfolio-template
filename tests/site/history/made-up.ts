/* Histories made up for a test: each year's days from January 1, as counts. */
import { sum } from "es-toolkit";
import { dayIn, type History } from "../../../src/site/history/history.ts";

/** A history of `years`, from January 1 of the first, made then, to the
    last day the last year has, with `more` in place of what it says. */
export function madeUp(years: Record<number, number[]>, more: Partial<History> = {}): History {
  const kept = Object.entries(years).map(([year, days]) => ({
    year: Number(year),
    total: sum(days),
    restricted: 0,
    days,
  }));
  const first = kept[0]?.year ?? 2020;
  const last = kept.at(-1);
  return {
    createdAt: `${first}-01-01T00:00:00Z`,
    asOf: last ? dayIn(last.year, last.days.length - 1) : `${first}-01-01`,
    years: kept,
    languages: [],
    ...more,
  };
}

/** A year's days, all `count`: 365 of them, or 366 in a leap year. */
export const everyDayOf = (year: number, count: number): number[] =>
  Array.from({ length: (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000 }, () => count);
