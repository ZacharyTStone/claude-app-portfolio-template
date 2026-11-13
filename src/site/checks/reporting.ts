/* What the config's checks find, the one way a check reports a problem, and
   what every check of one language is handed: that language, and the three
   questions most of them ask (is this a thread, is this an icon, is this
   link safe to follow). */

import type { Language } from "../../config/language.ts";
import { LOGOS } from "../../components/logos.ts";
import type { Site } from "../site.ts";
import { isSafeHref } from "./formats.ts";

/** What the checks found in a config. */
export type Findings = {
  /** What stops the build: each is a line of the message the build prints. */
  problems: string[];
  /** Advice: printed, but the build goes ahead. */
  notes: string[];
};

/** How a check reports: it says what has to be true, and the problem to
    list when it isn't. `problem` is recorded unless `isOk`.

    A problem's wording is what a person reads when the build stops, and
    what they search this folder for; tests/config.test.ts expects many of
    them word for word. */
export type ProblemUnless = (isOk: boolean, problem: string) => void;

/** Whether the config says something here: the value isn't left out, and
    isn't "". For what a part of the page can't do without (a picture's
    alt, a figure's title). */
export const isFilledIn = (value: unknown): boolean => Boolean(value);

/** What each check of one language is handed. */
export type LanguageChecks = {
  site: Site;
  language: Language;
  /** The ids of the language's threads: what a sidebar row, a topic or a
      link to "#about" can point at. */
  threadIds: Set<string>;
  /** Records a problem with this language. The message starts with the
      language's code ("en: …"), so the check's own wording leaves it out. */
  problemUnless: ProblemUnless;
  /** Records a problem unless `threadId` is one of the language's threads.
      `whatPointsAtIt` starts the message: `the sidebar's "About"`. */
  checkIsThread: (threadId: string, whatPointsAtIt: string) => void;
  /** Records a problem unless the stylesheet has the icon: for a part drawn
      with an .i-* icon and nothing else (a sidebar row). `whatHasIt` starts
      the message: `the sidebar's "About"`. */
  checkIsIcon: (iconName: string, whatHasIt: string) => void;
  /** As checkIsIcon, for a part that draws a logo's name as a lettered
      badge instead (LOGOS: a link card, a panel row). */
  checkIsIconOrLogo: (iconName: string, whatHasIt: string) => void;
  /** Records a problem unless a browser can safely follow `href`
      (isSafeHref). `whatLinksThere` starts the message: `the link card
      "Resume"`. */
  checkLinkIsSafe: (href: string, whatLinksThere: string) => void;
};

/** What the checks of the language `code` are handed. `stylesheetIcons` are
    the icons the styles have (iconsIn), and `problemUnless` records a
    problem for the whole site: each one recorded through the result says
    which language it's in. */
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
        stylesheetIcons.has(iconName) || LOGOS.includes(iconName),
        noSuchIcon(iconName, whatHasIt),
      ),
    checkLinkIsSafe: (href, whatLinksThere) =>
      problemInThisLanguageUnless(
        isSafeHref(href),
        `${whatLinksThere} links to "${href}", which should be a web, mailto, #thread or relative address`,
      ),
  };
}
