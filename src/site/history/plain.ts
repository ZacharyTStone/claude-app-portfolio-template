/* Each part of the history as one plain line, for Ask and llms.txt
   (../plain-answers.ts): what the part shows, said once, in English, with
   when it was true. It's GitHub's count, not the owner's words, so it goes
   out as a label, which Ask reads and never quotes. */
import type { GitHubPart, HistoryMark } from "../../config/github-history.ts";
import type { History } from "./history.ts";
import { busiestWeekday, languageShares, weekdayShares } from "./shares.ts";
import { historyStats } from "./stats.ts";
import { calendarRows } from "./weeks.ts";
import { weekdayName, writtenNumber, writtenShare } from "./words.ts";

/** The lines are in English, whatever the page's language. */
const ENGLISH = "en";

/** How every line ends: the counts are as of the build, not of the day
    they're read. */
const WHEN = "as of the site's last build";

const count = (amount: number): string => writtenNumber(ENGLISH, amount);

/** The days of the week from Monday, as Date numbers them. */
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** "4,812 contributions on GitHub since 2019, 1,204 of them in private
    repos (counted, not shown), as of the site's last build. Longest
    streak: 23 days, 2023-03-02 to 2023-03-24. Busiest day: 2023-03-14,
    with 41." */
function statsLine(history: History): string {
  const { total, restricted, since, streak, busiest } = historyStats(history);
  const sinceYear = since === undefined ? "" : ` since ${since}`;
  const privately = restricted > 0 ? `, ${count(restricted)} of them in private repos (counted, not shown)` : "";
  return [
    `${count(total)} contributions on GitHub${sinceYear}${privately}, ${WHEN}.`,
    ...(streak ? [`Longest streak: ${count(streak.days)} days, ${streak.from} to ${streak.to}.`] : []),
    ...(busiest ? [`Busiest day: ${busiest.day}, with ${count(busiest.count)}.`] : []),
  ].join(" ");
}

/** "Contributions on GitHub each year, as of the site's last build: 2019
    64, 2020 310 … Marked on it: Sample Co (2021-06)." */
function calendarLine(history: History, marks: HistoryMark[]): string {
  const rows = calendarRows(history, marks);
  const years = rows.map(({ year, total }) => `${year} ${count(total)}`).join(", ");
  const placed = rows.flatMap((row) => row.marks).map(({ label, at }) => `${label} (${at})`);
  const marked = placed.length ? ` Marked on it: ${placed.join(", ")}.` : "";
  return `Contributions on GitHub each year, ${WHEN}: ${years}.${marked}`;
}

/** "Languages in public repos on GitHub, by size: TypeScript 46%, … Other 8%." */
function languagesLine(history: History): string {
  const shares = languageShares(history).map(({ name, share }) => `${name ?? "Other"} ${writtenShare(ENGLISH, share)}`);
  return `Languages in public repos on GitHub, by size, ${WHEN}: ${shares.join(", ") || "none"}.`;
}

/** "Contributions on GitHub by day of the week: Monday 18%, …; the busiest, Tuesday." */
function rhythmLine(history: History): string {
  const shares = weekdayShares(history);
  const named = (weekday: number) => weekdayName(ENGLISH, weekday, "long");
  const days = MONDAY_FIRST.map((weekday) => `${named(weekday)} ${writtenShare(ENGLISH, shares[weekday] ?? 0)}`);
  const busiest = busiestWeekday(shares);
  const theBusiest = busiest === undefined ? "" : `; the busiest, ${named(busiest)}`;
  return `Contributions on GitHub by day of the week, ${WHEN}: ${days.join(", ")}${theBusiest}.`;
}

/** The line for one part of the history. */
export function historyLine(part: GitHubPart, history: History, marks: HistoryMark[] = []): string {
  if (part === "stats") return statsLine(history);
  if (part === "calendar") return calendarLine(history, marks);
  return part === "languages" ? languagesLine(history) : rhythmLine(history);
}
