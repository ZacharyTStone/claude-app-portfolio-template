/* What the languages part and the rhythm part show, worked out from the
   history: the share of the code in each language, and the share of the
   contributions made on each day of the week. */
import { sum, sumBy } from "es-toolkit";
import { everyDay, weekdayOf, type History } from "./history.ts";

/** How many languages have a bar of their own: the rest share one. */
export const TOP_LANGUAGES = 5;

export type LanguageShare = {
  /** As GitHub names it; null for the rest, together. */
  name: string | null;
  /** In bytes. */
  size: number;
  /** Of every byte, from 0 to 1. */
  share: number;
};

/** The languages written most, the most first, and then the rest
    together, if there are more: none for a history with no code. */
export function languageShares({ languages }: History): LanguageShare[] {
  const written = languages.filter((language) => language.size > 0);
  const total = sumBy(written, (language) => language.size);
  const shareOf = (name: string | null, size: number): LanguageShare => ({ name, size, share: size / total });
  const top = written.slice(0, TOP_LANGUAGES).map(({ name, size }) => shareOf(name, size));
  const rest = sumBy(written.slice(TOP_LANGUAGES), (language) => language.size);
  return rest > 0 ? [...top, shareOf(null, rest)] : top;
}

/** The contributions made on each day of the week, Sunday's first, as Date
    numbers the days. */
export function weekdayTotals(history: History): number[] {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const { day, count } of everyDay(history)) {
    const weekday = weekdayOf(day);
    totals[weekday] = (totals[weekday] ?? 0) + count;
  }
  return totals;
}

/** Each day of the week's share of the contributions, from 0 to 1, Sunday's
    first; all 0 for a history with none. */
export function weekdayShares(history: History): number[] {
  const totals = weekdayTotals(history);
  const total = sum(totals);
  return totals.map((count) => (total ? count / total : 0));
}

/** The day of the week with the largest share (0 for Sunday), the first
    by Date's numbers if two have as much; undefined if none has any. */
export function busiestWeekday(shares: number[]): number | undefined {
  const most = Math.max(...shares);
  return most > 0 ? shares.indexOf(most) : undefined;
}
