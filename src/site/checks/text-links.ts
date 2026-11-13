/* The checks of the links written in one language's text: Markdown's
   [label](href), wherever it is, read as the pages and the browser read it
   (hrefsIn), so a link inside bold or inside another link's label is found
   too. */

import { hrefsIn } from "../../config/markdown.ts";
import { SCRIPT_STRING_NAMES } from "../../config/strings.ts";
import { browserFollows } from "../../contracts/links.ts";
import { PAGE_IDS, personalTabId } from "../../contracts/page-ids.ts";
import type { LanguageCheck } from "./reporting.ts";

/** Every string in a value, however deep: an object's values and a list's
    items, in order. */
function everyStringIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(everyStringIn);
  return [];
}

/** How much of a text a problem quotes to say which text it means, in
    characters. */
const PROBLEM_EXCERPT_LENGTH = 40;

const excerptOf = (text: string): string =>
  text.length > PROBLEM_EXCERPT_LENGTH ? `${text.slice(0, PROBLEM_EXCERPT_LENGTH)}…` : text;

const checkTextLinksAreSafe: LanguageCheck = ({ language, checkLinkIsSafe }) => {
  for (const text of everyStringIn(language)) {
    for (const href of hrefsIn(text)) checkLinkIsSafe(href, `a link in "${excerptOf(text)}"`);
  }
};

/** A link to "#something" opens a tab: a thread, a personal answer's tab,
    or the home screen. */
const checkTextLinksOpenTabs: LanguageCheck = ({ language, threadIds, problemUnless }) => {
  const personalTabIds = language.questions.personal.map((personalAnswer) => personalTabId(personalAnswer.id));
  for (const href of everyStringIn(language).flatMap(hrefsIn)) {
    if (!href.startsWith("#")) continue;
    const tabId = href.slice(1);
    problemUnless(
      threadIds.has(tabId) || tabId === PAGE_IDS.home || personalTabIds.includes(tabId),
      `a link in the text points at #${tabId}, which isn't a thread`,
    );
  }
};

/** The script doesn't know the site's path, so in the text it shows itself
    (the personal answers and its own wording) it leaves a link to a file on
    the site ("/resume.pdf") as its words alone, and the visitor gets no
    link. */
const checkScriptTextLinks: LanguageCheck = ({ language, problemUnless }) => {
  const scriptWording = SCRIPT_STRING_NAMES.flatMap((key) => language.strings[key] ?? []);
  const textTheScriptShows = [...everyStringIn(language.questions.personal), ...scriptWording];
  for (const text of textTheScriptShows) {
    for (const href of hrefsIn(text)) {
      problemUnless(
        browserFollows(href),
        `a link in "${excerptOf(text)}" goes to "${href}", but the script shows this text, and only follows #tab, web and mailto links`,
      );
    }
  }
};

/** In the order their problems are listed. */
export const TEXT_LINK_CHECKS: LanguageCheck[] = [checkTextLinksAreSafe, checkTextLinksOpenTabs, checkScriptTextLinks];
