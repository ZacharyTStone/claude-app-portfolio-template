/* The config's checks, run before a build (src/integrations/check-config.ts).
   The config's shape is the type checker's to check, so these check what
   types can't say: what a value points at, what it looks like, and that
   the languages match.

   To check something new, write a function like its neighbours in the file
   it belongs to, with the message a person will read when the build stops,
   add it to that file's list, and give it a row in that file's test
   (tests/site/checks). */

import type { Site } from "../site.ts";
import { PARTS_CHECKS } from "./language.ts";
import { ADVICE } from "./notes.ts";
import { languageChecks, type Findings, type LanguageCheck, type ProblemUnless } from "./reporting.ts";
import { TEXT_LINK_CHECKS } from "./text-links.ts";
import { SITE_CHECKS } from "./whole-site.ts";
import { WORDING_CHECKS } from "./wording.ts";

/** The checks of one language, in the order their problems are listed. */
const LANGUAGE_CHECKS: LanguageCheck[] = [...PARTS_CHECKS, ...WORDING_CHECKS, ...TEXT_LINK_CHECKS];

/** Checks a site's config. `stylesheetIcons` are the icons the styles have
    (iconsIn): the ones a row or a link card in the config can name. */
export function checkSite(site: Site, stylesheetIcons: Set<string>): Findings {
  const findings: Findings = { problems: [], notes: [] };
  const problemUnless: ProblemUnless = (isOk, problem) => {
    if (!isOk) findings.problems.push(problem);
  };
  for (const check of SITE_CHECKS) check(site, problemUnless);
  for (const code of site.codes) {
    const checks = languageChecks(site, code, stylesheetIcons, problemUnless);
    for (const check of LANGUAGE_CHECKS) check(checks);
  }
  findings.notes.push(...ADVICE.flatMap((advise) => advise(site)));
  return findings;
}
