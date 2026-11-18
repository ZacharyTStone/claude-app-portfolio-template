/* Each part of the history as a plain line (src/site/history/plain.ts),
   for Ask and llms.txt: what the part shows, and when it was so. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { GITHUB_PARTS } from "../../../src/config/github-history.ts";
import { historyLine } from "../../../src/site/history/plain.ts";
import { sampleHistory } from "../../sample/github-history.ts";
import sample from "../../sample/site.config.ts";
import { madeUp } from "./made-up.ts";

const history = await sampleHistory();
const marks = sample.githubHistory?.marks;

test("the stats' line says what the history comes to, how much is private, and that it's as of the build", () => {
  assert.equal(
    historyLine("stats", history, marks),
    "5,002 contributions on GitHub since 2019, 1,099 of them in private repos (counted, not shown), as of the site's last build. Longest streak: 41 days, 2023-10-02 to 2023-11-11. Busiest day: 2023-03-18, with 31.",
  );
});

test("the calendar's line has each year's total, and the marks on it", () => {
  assert.equal(
    historyLine("calendar", history, marks),
    "Contributions on GitHub each year, as of the site's last build: 2019 28, 2020 231, 2021 485, 2022 682, 2023 821, 2024 868, 2025 1,137, 2026 750. Marked on it: Sample Co (2021-06), Example Labs (2024-02).",
  );
});

test("the languages' line has each bar's share, the rest's as Other", () => {
  assert.equal(
    historyLine("languages", history, marks),
    "Languages in public repos on GitHub, by size, as of the site's last build: TypeScript 50%, Go 16%, Python 10%, Rust 6%, CSS 5%, Other 13%.",
  );
});

test("the rhythm's line has each day's share from Monday, and the busiest", () => {
  assert.equal(
    historyLine("rhythm", history, marks),
    "Contributions on GitHub by day of the week, as of the site's last build: Monday 17%, Tuesday 17%, Wednesday 18%, Thursday 17%, Friday 16%, Saturday 8%, Sunday 7%; the busiest, Wednesday.",
  );
});

test("a history with nothing in it says so plainly, and claims no streak, busiest day or language", () => {
  const nothing = madeUp({ 2026: [0, 0] });
  assert.deepEqual(
    GITHUB_PARTS.map((part) => historyLine(part, nothing)),
    [
      "0 contributions on GitHub since 2026, as of the site's last build.",
      "Contributions on GitHub each year, as of the site's last build: 2026 0.",
      "Languages in public repos on GitHub, by size, as of the site's last build: none.",
      "Contributions on GitHub by day of the week, as of the site's last build: Monday 0%, Tuesday 0%, Wednesday 0%, Thursday 0%, Friday 0%, Saturday 0%, Sunday 0%.",
    ],
  );
});
