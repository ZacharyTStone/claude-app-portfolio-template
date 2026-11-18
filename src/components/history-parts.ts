/* What each part of the GitHub history draws, in the page's language, from
   the numbers src/site/history works out: the stats' tiles, the calendar's
   cells, the languages as bars, the rhythm's days. `code` is the page's
   language, and `strings` its wording. */
import type { Bars } from "../config/blocks.ts";
import type { Strings } from "../config/strings.ts";
import type { History } from "../site/history/history.ts";
import { busiestWeekday, languageShares, weekdayShares } from "../site/history/shares.ts";
import { historyStats } from "../site/history/stats.ts";
import type { CalendarRow, Level, PlacedMark, PlacedRepo } from "../site/history/weeks.ts";
import {
  daysInPieces,
  weekdayName,
  weekInOrder,
  writtenDay,
  writtenNumber,
  writtenShare,
  writtenSpan,
  type WrittenPart,
} from "../site/history/words.ts";

/** A tile of the stats: its label over its value, and a line under it.
    A tile whose value is a count has it as a number too, which the
    script counts up to as the tile comes in. */
export type Tile = { label: string; value: WrittenPart[]; under?: string; count?: number };

const figures = (text: string): WrittenPart[] => [{ text, isNumber: true }];

/** A span of days, or one day alone. */
const writtenDays = (code: string, from: string, to: string): string =>
  from === to ? writtenDay(code, from) : writtenSpan(code, from, to);

/** The tiles, in order: every contribution, since when, the longest
    streak and the busiest day. A history with no contribution has the
    first two alone. */
export function statTiles(history: History, strings: Strings, code: string): Tile[] {
  const { total, since, streak, busiest } = historyStats(history);
  return [
    { label: strings.historyContributions ?? "", value: figures(writtenNumber(code, total)), count: total },
    ...(since === undefined ? [] : [{ label: strings.historySince ?? "", value: figures(String(since)) }]),
    ...(streak
      ? [
          {
            label: strings.historyStreak ?? "",
            value: daysInPieces(code, streak.days),
            under: writtenDays(code, streak.from, streak.to),
            count: streak.days,
          },
        ]
      : []),
    ...(busiest
      ? [
          {
            label: strings.historyBusiest ?? "",
            value: figures(writtenNumber(code, busiest.count)),
            under: writtenDay(code, busiest.day),
            count: busiest.count,
          },
        ]
      : []),
  ];
}

/** The note under the stats, when GitHub counts private work: "Includes
    1,204 contributions to private repos, in every count and in the
    calendar. The repos stay private." */
export function privateNote(history: History, strings: Strings, code: string): string | undefined {
  const { restricted } = historyStats(history);
  if (restricted === 0 || !strings.historyPrivate) return undefined;
  return strings.historyPrivate.replace("{n}", writtenNumber(code, restricted));
}

/** The most dots a week has under it: a repo past them has only its name. */
const PINS_DRAWN = 3;

/** A cell of the calendar: its shade, and the days it counts with what was
    done on them, or none of either where the history has no week. A mark
    and the repos made in the week are drawn at it, and the history's
    latest week, the one with the day it was asked, is marked as now. */
export type Cell = { level?: Level; title?: string; mark?: PlacedMark; repos?: PlacedRepo[]; now?: boolean };

/** A row's cells, a column each, with its marks and repos at theirs.
    `asOf` is the history's last day. */
export function calendarCells(row: CalendarRow, code: string, asOf: string): Cell[] {
  return row.weeks.map((week, column) => {
    const mark = row.marks.find((placed) => placed.week === column);
    const repos = row.repos.filter((placed) => placed.week === column);
    const shaded = week
      ? { level: week.level, title: `${writtenDays(code, week.from, week.to)}: ${writtenNumber(code, week.count)}` }
      : {};
    return {
      ...shaded,
      ...(mark ? { mark } : {}),
      ...(repos.length ? { repos } : {}),
      ...(week && week.to === asOf ? { now: true } : {}),
    };
  });
}

/** The languages as bars: the most written first, in the accent, then the
    next four, then the rest together. None for a history with no code. */
export function languageBars(history: History, strings: Strings, code: string): Bars | undefined {
  const shares = languageShares(history);
  if (!shares.length) return undefined;
  return {
    title: strings.historyLanguages ?? "",
    rows: shares.map(({ name, size, share }, place) => ({
      label: name ?? strings.historyOther ?? "",
      value: writtenShare(code, share),
      amount: size,
      accent: place === 0,
    })),
  };
}

/** How tall the busiest day's bar is, in percent of the drawing: the rest
    is room for its share, written over it. */
const TALLEST_BAR_PERCENT = 72;

/** A day of the rhythm: its name, its share written out, how tall its bar
    is (in percent of the drawing), and whether it's the busiest. */
export type RhythmDay = { name: string; share: string; height: number; busiest: boolean };

/** The days of the week in the order the page's language has them. */
export function rhythmDays(history: History, code: string): RhythmDay[] {
  const shares = weekdayShares(history);
  const most = Math.max(...shares);
  const busiest = busiestWeekday(shares);
  return weekInOrder(code).map((weekday) => {
    const share = shares[weekday] ?? 0;
    return {
      name: weekdayName(code, weekday),
      share: writtenShare(code, share),
      height: most > 0 ? Math.round((share / most) * TALLEST_BAR_PERCENT * 100) / 100 : 0,
      busiest: weekday === busiest,
    };
  });
}

/** The most dots a row's weeks have under them, one a repo, to the three
    the calendar draws: how much room the row needs under its strip. */
export function pinDepth(row: CalendarRow): number {
  const byWeek = new Map<number, number>();
  for (const { week } of row.repos) byWeek.set(week, (byWeek.get(week) ?? 0) + 1);
  return Math.min(PINS_DRAWN, Math.max(0, ...byWeek.values()));
}
