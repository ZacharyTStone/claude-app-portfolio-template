/* The checks of the GitHub history: its marks, the parts an answer places,
   and where its wording takes a number. That a mark is in a year of the
   history can only be checked once the history is fetched
   (src/integrations/history.ts). */

import { GITHUB_PARTS, type GitHubPart } from "../../config/github-history.ts";
import type { Site } from "../site.ts";
import { isMonth } from "./formats.ts";
import { isFilledIn, type LanguageCheck, type LanguageChecks, type ProblemUnless } from "./reporting.ts";

const GUIDE = "docs/github-history.md";

/** A mark is written on the calendar at its month, under its name. */
export function checkHistoryMarks({ config }: Site, problemUnless: ProblemUnless): void {
  for (const { at, label } of config.githubHistory?.marks ?? []) {
    const which = isFilledIn(label) ? `"${label}"` : "a mark";
    problemUnless(isFilledIn(label), `githubHistory.marks has a mark at ${at} without a label`);
    problemUnless(isMonth(at), `githubHistory.marks has ${which} at "${at}", which should be a month, like "2022-04"`);
  }
}

/** A part is drawn from the history the build fetches for
    `githubHistory`: without it, there's nothing to draw. */
export function checkGitHubPart(part: GitHubPart, where: string, { site, problemUnless }: LanguageChecks): void {
  problemUnless(
    GITHUB_PARTS.includes(part),
    `${where} has the GitHub part "${part}", which should be one of ${GITHUB_PARTS.map((name) => `"${name}"`).join(", ")}`,
  );
  problemUnless(
    Boolean(site.config.githubHistory),
    `${where} has the GitHub part "${part}", but the config has no githubHistory to draw it from: add githubHistory: { user: "…" } (${GUIDE})`,
  );
}

/** Where the page writes a number into the history's wording. */
const PLACEHOLDERS = { historyPrivate: "{n}", historyCalendar: "{year}" } as const;

/** Without its placeholder, the note would leave out how many are private,
    and the calendar's title since when. */
export const checkHistoryPlaceholders: LanguageCheck = ({ site, language, problemUnless }) => {
  if (!site.config.githubHistory) return;
  for (const [name, placeholder] of Object.entries(PLACEHOLDERS) as Array<[keyof typeof PLACEHOLDERS, string]>) {
    const wording = language.strings[name];
    problemUnless(
      !wording || wording.includes(placeholder),
      `strings.${name} should have ${placeholder} in it, where the page writes the number`,
    );
  }
};
