/* What each part of the GitHub history draws (src/components/history-parts.ts),
   in English and in another language: the words are the config's, the
   numbers, days and weekdays the platform's. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarCells, languageBars, privateNote, rhythmDays, statTiles } from "../../src/components/history-parts.ts";
import { ENGLISH_STRINGS } from "../../src/config/english-strings.ts";
import { calendarRows } from "../../src/site/history/weeks.ts";
import { sampleHistory } from "../sample/github-history.ts";
import { madeUp } from "../site/history/made-up.ts";

const history = await sampleHistory();

test("the stats' tiles: every contribution, since when, the longest streak in days with its span, and the busiest day", () => {
  assert.deepEqual(statTiles(history, ENGLISH_STRINGS, "en"), [
    { label: "Contributions", value: [{ text: "5,002", isNumber: true }] },
    { label: "Since", value: [{ text: "2019", isNumber: true }] },
    {
      label: "Longest streak",
      value: [
        { text: "41", isNumber: true },
        { text: " ", isNumber: false },
        { text: "days", isNumber: false },
      ],
      under: "Oct 2 – Nov 11, 2023",
    },
    { label: "Busiest day", value: [{ text: "31", isNumber: true }], under: "Mar 18, 2023" },
  ]);
});

test("a history with nothing done has no streak and no busiest day to show", () => {
  const tiles = statTiles(madeUp({ 2026: [0, 0] }), ENGLISH_STRINGS, "en");
  assert.deepEqual(
    tiles.map((tile) => tile.label),
    ["Contributions", "Since"],
  );
});

test("the note says how much private work is in the count, and there's none without any", () => {
  assert.equal(
    privateNote(history, ENGLISH_STRINGS, "en"),
    "Includes 1,099 contributions to private repos, in every count and in the calendar. The repos stay private.",
  );
  assert.equal(privateNote(madeUp({ 2026: [3] }), ENGLISH_STRINGS, "en"), undefined);
});

test("a calendar cell is shaded, and its title says its days and what was done on them; a mark is at its week", () => {
  const [row] = calendarRows(madeUp({ 2023: [1, 2, 0, 0, 0, 0, 3, 4] }), [{ at: "2023-01", label: "Start" }]);
  assert.ok(row);
  const [first, second, third] = calendarCells(row, "en");
  assert.deepEqual(first, {
    level: 3,
    title: "Jan 1 – 7, 2023: 6",
    mark: { at: "2023-01", label: "Start", week: 0, late: false },
  });
  assert.deepEqual(second, { level: 1, title: "Jan 8, 2023: 4" });
  assert.deepEqual(third, {});
});

test("the languages are bars like any other figure's, the first in the accent and the rest as Other", () => {
  const bars = languageBars(history, ENGLISH_STRINGS, "en");
  assert.equal(bars?.title, "Languages in public repos");
  assert.deepEqual(
    bars?.rows.map(({ label, value, accent }) => [label, value, accent]),
    [
      ["TypeScript", "50%", true],
      ["Go", "16%", false],
      ["Python", "10%", false],
      ["Rust", "6%", false],
      ["CSS", "5%", false],
      ["Other", "13%", false],
    ],
  );
  assert.equal(languageBars(madeUp({ 2026: [1] }), ENGLISH_STRINGS, "en"), undefined);
});

test("the rhythm's days are in the page's week, the busiest tallest and marked", () => {
  const english = rhythmDays(history, "en");
  assert.deepEqual(
    english.map(({ name }) => name),
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  );
  assert.deepEqual(
    english.filter((day) => day.busiest).map(({ name, share, height }) => [name, share, height]),
    [["Wed", "18%", 72]],
  );
  assert.equal(rhythmDays(history, "fr")[0]?.name, "lun.");
});

test("a history with nothing done has a rhythm of no bars and no busiest day", () => {
  const days = rhythmDays(madeUp({ 2026: [0] }), "en");
  assert.deepEqual(new Set(days.map(({ height, busiest }) => [height, busiest].join())), new Set(["0,false"]));
});
