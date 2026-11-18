/* What each part of the GitHub history draws, in the page's language, from
   the numbers src/site/history works out: the stats' tiles, the calendar's
   cells, the languages as bars, the rhythm's days. `code` is the page's
   language, and `strings` its wording. */
import type { Bars } from "../config/blocks.ts";
import type { Strings } from "../config/strings.ts";
import type { History } from "../site/history/history.ts";
import { busiestWeekday, languageShares, weekdayShares } from "../site/history/shares.ts";
import { historyStats } from "../site/history/stats.ts";
import type { CalendarRow, Level, PlacedMark } from "../site/history/weeks.ts";
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

/** A tile of the stats: its label over its value, and a line under it. */
export type Tile = { label: string; value: WrittenPart[]; under?: string };

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
    { label: strings.historyContributions ?? "", value: figures(writtenNumber(code, total)) },
    ...(since === undefined ? [] : [{ label: strings.historySince ?? "", value: figures(String(since)) }]),
    ...(streak
      ? [
          {
            label: strings.historyStreak ?? "",
            value: daysInPieces(code, streak.days),
            under: writtenDays(code, streak.from, streak.to),
          },
        ]
      : []),
    ...(busiest
      ? [
          {
            label: strings.historyBusiest ?? "",
            value: figures(writtenNumber(code, busiest.count)),
            under: writtenDay(code, busiest.day),
          },
        ]
      : []),
  ];
}

/** The note under the stats, when GitHub counts private work: "Includes
    1,204 in private repos, counted but not shown." */
export function privateNote(history: History, strings: Strings, code: string): string | undefined {
  const { restricted } = historyStats(history);
  if (restricted === 0 || !strings.historyPrivate) return undefined;
  return strings.historyPrivate.replace("{n}", writtenNumber(code, restricted));
}

/** A cell of the calendar: its shade, and the days it counts with what was
    done on them, or none of either where the history has no week. */
export type Cell = { level?: Level; title?: string; mark?: PlacedMark };

/** A row's cells, a column each, with its marks at theirs. */
export function calendarCells(row: CalendarRow, code: string): Cell[] {
  return row.weeks.map((week, column) => {
    const mark = row.marks.find((placed) => placed.week === column);
    const shaded = week
      ? { level: week.level, title: `${writtenDays(code, week.from, week.to)}: ${writtenNumber(code, week.count)}` }
      : {};
    return { ...shaded, ...(mark ? { mark } : {}) };
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
