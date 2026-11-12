/* The config's checks, run before a build (src/integrations/check-config.ts).
   The config's shape is the type checker's to check (`npm run typecheck`),
   so these check only what types can't: what a value points at, what it
   looks like, and that the languages match.

   This file is the list of checks, in the order their problems are printed.
   Each check is a function with a comment that says what has to be true and
   how a site gets it wrong, in one of the files in validate/:

     whole-site.ts  what's set once for the site: its languages match, its
                    address, links, social card, Ask and the viewer
     language.ts    one language: its threads, sidebar, panel, question
                    card, wording, and the links in its text
     blocks.ts      one block of an answer: a picture, a link card, a figure
     shapes.ts      what a value has to look like: a language code, a path
                    on the site, a link that's safe to follow
     reporting.ts   what the checks find (Findings), and how a check
                    reports a problem

   To check something new, write a function like its neighbours in the file
   it belongs to, with the message a person will read when the build stops,
   add it to the list here, and give it a test in tests/config.test.ts. */

import type { Site } from "./site.ts";
import {
  checkHomePrompts,
  checkLanguageRow,
  checkLinkedInWording,
  checkLocale,
  checkPanel,
  checkPartWording,
  checkPersonalAnswerIds,
  checkPlaceholders,
  checkPreloadedFonts,
  checkScriptTextLinks,
  checkSidebarGroups,
  checkSidebarRows,
  checkTextLinksAreSafe,
  checkTextLinksOpenTabs,
  checkThreads,
  checkTopics,
  checkUpgradeRow,
} from "./validate/language.ts";
import { languageChecks, type Findings, type LanguageChecks, type ProblemUnless } from "./validate/reporting.ts";
import {
  checkAskRunsOnItsHost,
  checkContactLinks,
  checkHsts,
  checkLanguageCodes,
  checkLanguagesMatch,
  checkNameLanguage,
  checkPersonImage,
  checkSiteAddress,
  checkSocialCard,
  checkThemeColour,
  checkTimeZone,
  checkViewer,
  noteManyTopics,
} from "./validate/whole-site.ts";

// What other files have always imported from here.
export { iconsIn } from "./stylesheet.ts";
export type { Findings } from "./validate/reporting.ts";
export { isSafeHref } from "./validate/shapes.ts";

/** The checks of the site as a whole, in the order their problems are
    listed: all of them before any language's. */
const SITE_CHECKS: Array<(site: Site, problemUnless: ProblemUnless) => void> = [
  checkLanguagesMatch,
  checkLanguageCodes,
  checkSiteAddress,
  checkTimeZone,
  checkHsts,
  checkNameLanguage,
  checkContactLinks,
  checkThemeColour,
  checkSocialCard,
  checkPersonImage,
  checkAskRunsOnItsHost,
  checkViewer,
];

/** The checks of one language, in the order their problems are listed.
    They're run for each language in turn, and each of their problems
    starts with its language's code ("en: …"). */
const LANGUAGE_CHECKS: Array<(checks: LanguageChecks) => void> = [
  checkLocale,
  checkPreloadedFonts,
  checkHomePrompts,
  checkThreads,
  checkSidebarRows,
  checkSidebarGroups,
  checkPanel,
  checkTopics,
  checkPersonalAnswerIds,
  checkPlaceholders,
  checkLanguageRow,
  checkLinkedInWording,
  checkUpgradeRow,
  checkPartWording,
  checkTextLinksAreSafe,
  checkTextLinksOpenTabs,
  checkScriptTextLinks,
];

/** Checks a site's config. `stylesheetIcons` are the icons the styles have
    (iconsIn): the ones a row or a link card in the config can name. */
export function validate(site: Site, stylesheetIcons: Set<string>): Findings {
  const findings: Findings = { problems: [], notes: [] };
  const problemUnless: ProblemUnless = (isOk, problem) => {
    if (!isOk) findings.problems.push(problem);
  };
  for (const check of SITE_CHECKS) check(site, problemUnless);
  noteManyTopics(site, findings.notes);
  for (const code of site.codes) {
    const checks = languageChecks(site, code, stylesheetIcons, problemUnless);
    for (const check of LANGUAGE_CHECKS) check(checks);
  }
  return findings;
}
