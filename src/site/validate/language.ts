/* The checks of one language: everything its page says that points at
   something (a thread, an answer, an icon, a file) or has to look a certain
   way. Each is handed the language and what the checks share
   (reporting.ts); ../validate.ts runs them in order, once for each
   language. */

import { personalAnswerId, threadAnswerId } from "../../contracts/ask.ts";
import { ID } from "../../config/language.ts";
import { browserFollows } from "../../contracts/links.ts";
import { hrefsIn } from "../../config/markdown.ts";
import { ALL_SCRIPT_STRINGS, PART_STRINGS } from "../../config/strings.ts";
import { CHATS_GROUP, ID_PREFIXES, PAGE_IDS, personalTab, titleId } from "../../contracts/page-ids.ts";
import { PROBLEM_EXCERPT_LENGTH } from "../constants.ts";
import { panelRows } from "../panel.ts";
import { answerBlocksIn, checkBlock, picturesIn } from "./blocks.ts";
import { isFilledIn, type LanguageChecks } from "./reporting.ts";
import { isLocale, isPathOnSite } from "./shapes.ts";

// ---- What the checks below share ---------------------------------------------------------

/** Whether `id` can be a thread's, a sidebar group's or a personal
    answer's id: lowercase letters, digits and dashes ("about"). Each ends
    up in an element's id and after a # in an address. */
const looksLikeAnId = (id: string): boolean => ID.test(id);

const areAllDifferent = (ids: string[]): boolean => new Set(ids).size === ids.length;

/** Every string in a value, however deep: an object's values and a list's
    items, in order. */
function everyStringIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(everyStringIn);
  return [];
}

/** The start of a text, to name it by in a problem: all of it when it's
    short, or its first characters and "…". */
const excerptOf = (text: string): string =>
  text.length > PROBLEM_EXCERPT_LENGTH ? `${text.slice(0, PROBLEM_EXCERPT_LENGTH)}…` : text;

// ---- The page's own settings -------------------------------------------------------------

/** The page's og:locale is written as Open Graph writes one, with an
    underscore ("en_US"), where the language's code would have a dash. */
export function checkLocale({ language, problemUnless }: LanguageChecks): void {
  problemUnless(isLocale(language.locale), `locale should look like "en_US"`);
}

/** The fonts a page loads up front are files on this site: the security
    policy lets a font come from nowhere else, so a font at another site's
    address would be asked for and refused. */
export function checkPreloadedFonts({ language, problemUnless }: LanguageChecks): void {
  for (const href of language.meta.preload) {
    problemUnless(isPathOnSite(href), `meta.preload has "${href}", which should be a path on this site`);
  }
}

// ---- The home screen ---------------------------------------------------------------------

/** A question to start with, on the home screen, gets one of the site's
    answers, named as /ask names them: "work.2" for the second answer in the
    thread "work", "personal-food.1" for the personal answer "food". A site
    gets it wrong by counting from 0, by leaving "personal-" off, or by
    removing the answer and keeping the prompt. */
export function checkHomePrompts({ language, problemUnless }: LanguageChecks): void {
  const answerIds = new Set([
    ...language.threads.flatMap((thread) =>
      thread.messages.map((_, messageIndex) => threadAnswerId(thread.id, messageIndex + 1)),
    ),
    ...language.questions.personal.map((personalAnswer) => personalAnswerId(personalAnswer.id)),
  ]);
  for (const prompt of language.home.prompts ?? []) {
    problemUnless(
      answerIds.has(prompt.answer),
      `the home prompt "${prompt.q}" gets the answer "${prompt.answer}", which isn't one: a thread's nth answer is "<thread>.<n>", and a personal answer "${personalAnswerId("<id>")}"`,
    );
  }
}

// ---- The threads -------------------------------------------------------------------------

/** The ids the page gives its own parts ("top", "main", "account-menu"…). */
const IDS_THE_PAGE_USES: string[] = Object.values(PAGE_IDS);

/** What follows a tab's id in the id of its title ("-title"): the title of
    the thread "about" is #about-title. */
const TITLE_ID_SUFFIX = titleId("");

/** Whether a thread with this id would share it with something else in the
    page: one of the page's own parts, an id the page or the script makes up
    (each starts with one of ID_PREFIXES: "chat-1", "group-work"), or the
    title of another tab (a thread "about-title" and the title of "about"). */
const isUsedByThePage = (id: string): boolean =>
  IDS_THE_PAGE_USES.includes(id) || ID_PREFIXES.some((prefix) => id.startsWith(prefix)) || id.endsWith(TITLE_ID_SUFFIX);

/** Each thread is a tab at #<id>: its id is one no other thread has, looks
    like an id, and isn't taken by the page itself, and it has at least one
    question, or the tab would be empty. Every block of its answers is
    checked too (blocks.ts). */
export function checkThreads(checks: LanguageChecks): void {
  const { language, threadIds, problemUnless } = checks;
  problemUnless(threadIds.size === language.threads.length, "two threads have the same id");
  for (const thread of language.threads) {
    problemUnless(
      looksLikeAnId(thread.id),
      `the thread id "${thread.id}" should be lowercase letters, digits and dashes`,
    );
    problemUnless(!isUsedByThePage(thread.id), `"${thread.id}" is used by the page itself; pick another thread id`);
    problemUnless(thread.messages.length > 0, `the thread "${thread.id}" has no messages`);
    const answerBlocks = thread.messages.flatMap((message) => message.a);
    for (const block of answerBlocks) checkBlock(block, `the thread "${thread.id}"`, checks);
  }
}

// ---- The sidebar and the details panel ---------------------------------------------------

/** Each row at the top of the sidebar opens a thread, and is drawn with an
    icon from the stylesheet (a logo's badge isn't drawn there). A site gets
    it wrong by renaming a thread and leaving the row with the old id. */
export function checkSidebarRows({ language, checkIsThread, checkIsIcon }: LanguageChecks): void {
  for (const row of language.sidebar.nav) {
    checkIsThread(row.tab, `the sidebar's "${row.label}"`);
    checkIsIcon(row.icon, `the sidebar's "${row.label}"`);
  }
}

/** Each of the sidebar's groups has a heading with an id made from the
    group's ("group-work"), so the groups' ids are ids, no two the same, and
    none is the one the script gives the visitor's own chats (CHATS_GROUP).
    Every row in a group opens a thread. */
export function checkSidebarGroups({ language, problemUnless, checkIsThread }: LanguageChecks): void {
  const { groups } = language.sidebar;
  const groupIds = groups.map((group) => group.id);
  problemUnless(
    areAllDifferent(groupIds) && !groupIds.includes(CHATS_GROUP),
    `the sidebar's group ids should be different from each other and from "${CHATS_GROUP}"`,
  );
  for (const group of groups) {
    problemUnless(
      looksLikeAnId(group.id),
      `the sidebar's group id "${group.id}" should be lowercase letters, digits and dashes`,
    );
    for (const row of group.tabs) checkIsThread(row.tab, `the sidebar's "${row.title}"`);
  }
}

/** In the details panel, each step of the career's checklist opens a
    thread, and each row of its lists has an icon the stylesheet has (or a
    logo) and, when it's a link, one that's safe to follow. */
export function checkPanel({ language, checkIsThread, checkIsIconOrLogo, checkLinkIsSafe }: LanguageChecks): void {
  for (const step of language.panel.progress?.steps ?? []) checkIsThread(step.tab, `the panel's "${step.title}"`);
  for (const row of panelRows(language.panel)) {
    checkIsIconOrLogo(row.icon, `the panel's "${row.label}"`);
    if (row.href != null) checkLinkIsSafe(row.href, `the panel's "${row.label}"`);
  }
}

// ---- The question card -------------------------------------------------------------------

/** A topic in the question card either opens a thread at once (`tab`), or
    asks a second question (`ask`) over what to pick from: its `choices`,
    each a thread, or the personal answers (`personal`). A site gets it
    wrong by giving a topic choices and no `ask`, or nothing to open at
    all. */
export function checkTopics({ language, problemUnless, checkIsThread }: LanguageChecks): void {
  for (const topic of language.questions.topics) {
    const thisTopic = `the question card's "${topic.label}"`;
    if (topic.tab) checkIsThread(topic.tab, thisTopic);
    for (const choice of topic.choices ?? []) checkIsThread(choice.tab, thisTopic);
    const opensSomething = Boolean(topic.tab || topic.personal || topic.choices?.length);
    problemUnless(opensSomething, `${thisTopic} opens nothing`);
    const opensThreadOrAsksWhich = Boolean(topic.tab || topic.ask);
    problemUnless(opensThreadOrAsksWhich, `${thisTopic} needs an "ask" for its second question`);
  }
}

/** A personal answer's tab is #personal-<id>, and its answer
    "personal-<id>.1", which the script reads back as that tab's id: so its
    id looks like a thread's, and no two personal answers share one. */
export function checkPersonalAnswerIds({ language, problemUnless }: LanguageChecks): void {
  const ids = language.questions.personal.map((personalAnswer) => personalAnswer.id);
  problemUnless(areAllDifferent(ids), "two personal answers have the same id");
  for (const id of ids) {
    problemUnless(looksLikeAnId(id), `the personal answer id "${id}" should be lowercase letters, digits and dashes`);
  }
}

// ---- Wording -----------------------------------------------------------------------------

/** Where the page puts the visitor's question into the email that
    "Something else" drafts. */
const QUESTION_PLACEHOLDER = "{question}";

/** Where the page puts the file's name into a thread's "Read …" line. */
const FILE_PLACEHOLDER = "{file}";

/** The wording the page fills something into says where it goes. Without
    its placeholder the email would be sent without the question, and the
    file's name would run on from the last word of the "Read …" line. */
export function checkPlaceholders({ language, problemUnless }: LanguageChecks): void {
  problemUnless(
    language.asked.email.includes(QUESTION_PLACEHOLDER),
    `asked.email should have ${QUESTION_PLACEHOLDER} in it, where the question goes`,
  );
  problemUnless(
    language.strings.status.includes(FILE_PLACEHOLDER),
    `strings.status should have ${FILE_PLACEHOLDER} in it, where the file goes ("Read ${FILE_PLACEHOLDER}")`,
  );
}

/** On a site in more than one language, the account menu has a row that
    opens the other language's page, and the row needs its label. A site
    gets it wrong by adding a second language to a config written for one. */
export function checkLanguageRow({ site, language, problemUnless }: LanguageChecks): void {
  const isOnlyLanguage = site.codes.length <= 1;
  if (isOnlyLanguage) return;
  problemUnless(
    isFilledIn(language.account.language),
    "account.language is missing: the account menu's row that opens the other language",
  );
}

/** With a LinkedIn profile in the config's links, "Something else" also
    offers a message to send there: it needs the link's label, and the
    message to copy. */
export function checkLinkedInWording({ site, language, problemUnless }: LanguageChecks): void {
  if (!site.config.links.linkedin) return;
  problemUnless(isFilledIn(language.asked.linkedin), "asked.linkedin is missing (links.linkedin needs it)");
  problemUnless(isFilledIn(language.asked.message), "asked.message is missing (links.linkedin needs it)");
}

/** The account menu's "Upgrade" row opens a thread: the one that says how
    to hire the owner. */
export function checkUpgradeRow({ language, checkIsThread }: LanguageChecks): void {
  checkIsThread(language.account.upgrade.tab, "the account menu's upgrade row");
}

/** A part only some sites have, as the check of its wording sees it. */
type OptionalPart = {
  /** Whether this site has the part, in this language. */
  isOnTheSite: boolean;
  /** What a problem calls the part: "strings.viewerOpen is missing (viewer
      needs it)". */
  nameInProblem: string;
};

/** The wording for the parts only some sites have (PART_STRINGS: the
    viewer's buttons) is optional in the config's type, so only this check
    can say that a site with the part has left it out. A site gets it wrong
    by adding a viewer, or a picture that moves, and not the words for its
    buttons. */
export function checkPartWording({ site, language, problemUnless }: LanguageChecks): void {
  // A part added to PART_STRINGS needs a line here, and the type says so.
  const parts = {
    viewer: { isOnTheSite: Boolean(site.config.viewer), nameInProblem: "viewer" },
    // Only the picture's own file says whether it's one a visitor plays
    // (src/site/pictures.ts), so any picture that moves asks for the words.
    movingPictures: {
      isOnTheSite: answerBlocksIn(language).some((block) => picturesIn(block).some((picture) => picture.still)),
      nameInProblem: "a picture with a still",
    },
  } satisfies Record<keyof typeof PART_STRINGS, OptionalPart>;
  for (const partName of Object.keys(PART_STRINGS) as Array<keyof typeof PART_STRINGS>) {
    const part = parts[partName];
    if (!part.isOnTheSite) continue;
    for (const key of PART_STRINGS[partName]) {
      problemUnless(isFilledIn(language.strings[key]), `strings.${key} is missing (${part.nameInProblem} needs it)`);
    }
  }
}

// ---- Links in the text -------------------------------------------------------------------
// Markdown's [label](href), wherever it is in the language's text, read as
// the pages and the browser read it (hrefsIn): a link inside bold, or inside
// another link's label, is found too.

/** Every link written in the text is safe to follow: none runs code
    (javascript:), and none hides a scheme behind a space or a line break. */
export function checkTextLinksAreSafe({ language, checkLinkIsSafe }: LanguageChecks): void {
  for (const text of everyStringIn(language)) {
    for (const href of hrefsIn(text)) checkLinkIsSafe(href, `a link in "${excerptOf(text)}"`);
  }
}

/** A link in the text to "#something" opens a tab: a thread, a personal
    answer's tab, or the home screen (#top). A site gets it wrong by
    renaming a thread and leaving a sentence that links to the old id. */
export function checkTextLinksOpenTabs({ language, threadIds, problemUnless }: LanguageChecks): void {
  const personalTabIds = language.questions.personal.map((personalAnswer) => personalTab(personalAnswer.id));
  for (const href of everyStringIn(language).flatMap(hrefsIn)) {
    if (!href.startsWith("#")) continue;
    const tabId = href.slice(1);
    problemUnless(
      threadIds.has(tabId) || tabId === PAGE_IDS.top || personalTabIds.includes(tabId),
      `a link in the text points at #${tabId}, which isn't a thread`,
    );
  }
}

/** The text the browser code shows itself (the personal answers, and the
    script's own wording) links only where the script can follow: a #tab, a
    web or a mailto address. The script doesn't know the site's path, so it
    leaves a link to a file on the site ("/resume.pdf") as its words alone,
    and the visitor gets no link. */
export function checkScriptTextLinks({ language, problemUnless }: LanguageChecks): void {
  const scriptWording = ALL_SCRIPT_STRINGS.flatMap((key) => language.strings[key] ?? []);
  const textTheScriptShows = [...everyStringIn(language.questions.personal), ...scriptWording];
  for (const text of textTheScriptShows) {
    for (const href of hrefsIn(text)) {
      problemUnless(
        browserFollows(href),
        `a link in "${excerptOf(text)}" goes to "${href}", but the script shows this text, and only follows #tab, web and mailto links`,
      );
    }
  }
}
