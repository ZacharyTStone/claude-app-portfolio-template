/* What the config's checks find, how a check reports a problem, and what
   every check of one language is handed. */

import { LOGO_NAMES } from "../icons.ts";
import type { Site, SiteLanguage } from "../site.ts";
import { isSafeHref } from "./formats.ts";

export type Findings = {
  /** What stops the build: each is a line of the message the build prints. */
  problems: string[];
  /** Advice: printed, but the build goes ahead. */
  notes: string[];
};

/** Records `problem` unless `isOk`. A problem's wording is what a person
    reads when the build stops, and what they search this folder for: the
    tests in tests/site/checks hold each word for word. */
export type ProblemUnless = (isOk: boolean, problem: string) => void;

/** Whether the config says something here: not left out, and not "". */
export const isFilledIn = (value: unknown): boolean => Boolean(value);

/** What each check of one language is handed. A problem recorded through
    it starts with the language's code ("en: …"), so a check's own wording
    leaves the language out. */
export type LanguageChecks = {
  site: Site;
  code: string;
  language: SiteLanguage;
  /** What a sidebar row, a topic or a link to "#about" can point at. */
  threadIds: Set<string>;
  problemUnless: ProblemUnless;
  /** `whatPointsAtIt` starts the problem: `the sidebar's "About"`. */
  checkIsThread: (threadId: string, whatPointsAtIt: string) => void;
  /** For a part drawn with one of the stylesheet's .i-* icons and nothing
      else (a sidebar row). */
  checkIsIcon: (iconName: string, whatHasIt: string) => void;
  /** For a part that draws a logo's name as a lettered badge instead
      (LOGO_NAMES: a link card, a panel row). */
  checkIsIconOrLogo: (iconName: string, whatHasIt: string) => void;
  checkLinkIsSafe: (href: string, whatLinksThere: string) => void;
};

export type LanguageCheck = (checks: LanguageChecks) => void;

/** What the checks of the language `code` are handed. `stylesheetIcons` are
    the icons the styles have (iconsIn). */
export function languageChecks(
  site: Site,
  code: string,
  stylesheetIcons: Set<string>,
  problemUnless: ProblemUnless,
): LanguageChecks {
  const language = site.language(code);
  const threadIds = new Set(language.threads.map((thread) => thread.id));
  const problemInThisLanguageUnless: ProblemUnless = (isOk, problem) => problemUnless(isOk, `${code}: ${problem}`);
  const noSuchIcon = (iconName: string, whatHasIt: string) =>
    `${whatHasIt} has the icon "${iconName}", but src/styles has no .i-${iconName}`;
  return {
    site,
    code,
    language,
    threadIds,
    problemUnless: problemInThisLanguageUnless,
    checkIsThread: (threadId, whatPointsAtIt) =>
      problemInThisLanguageUnless(
        threadIds.has(threadId),
        `${whatPointsAtIt} points at #${threadId}, which isn't a thread`,
      ),
    checkIsIcon: (iconName, whatHasIt) =>
      problemInThisLanguageUnless(stylesheetIcons.has(iconName), noSuchIcon(iconName, whatHasIt)),
    checkIsIconOrLogo: (iconName, whatHasIt) =>
      problemInThisLanguageUnless(
        stylesheetIcons.has(iconName) || LOGO_NAMES.includes(iconName),
        noSuchIcon(iconName, whatHasIt),
      ),
    checkLinkIsSafe: (href, whatLinksThere) =>
      problemInThisLanguageUnless(
        isSafeHref(href),
        `${whatLinksThere} links to "${href}", which should be a web, mailto, #thread or relative address`,
      ),
  };
}
