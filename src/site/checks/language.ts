/* The checks of one language's parts: what each points at (a thread, an
   answer, an icon, a file) and what its ids look like. */

import { ID_PATTERN } from "../../config/language.ts";
import { personalAnswerId, threadAnswerId } from "../../contracts/ask.ts";
import { CHATS_GROUP, ID_PREFIXES, PAGE_IDS, titleId } from "../../contracts/page-ids.ts";
import { panelRows } from "../panel.ts";
import { checkBlock } from "./blocks.ts";
import { isLocale, isPathOnSite } from "./formats.ts";
import type { LanguageCheck } from "./reporting.ts";

/** An id ends up in an element's id and after a # in an address. */
const looksLikeAnId = (id: string): boolean => ID_PATTERN.test(id);

const areAllDifferent = (ids: string[]): boolean => new Set(ids).size === ids.length;

const checkLocale: LanguageCheck = ({ language, problemUnless }) => {
  problemUnless(isLocale(language.locale), `locale should look like "en_US"`);
};

/** The security policy lets a font come from nowhere but this site, so one
    at another site's address would be asked for and refused. */
const checkPreloadedFonts: LanguageCheck = ({ language, problemUnless }) => {
  for (const href of language.meta.preload) {
    problemUnless(isPathOnSite(href), `meta.preload has "${href}", which should be a path on this site`);
  }
};

const checkHomePrompts: LanguageCheck = ({ language, problemUnless }) => {
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
};

const IDS_OF_THE_PAGES_OWN_PARTS: string[] = Object.values(PAGE_IDS);

/** What follows a tab's id in the id of its title: the title of the thread
    "about" is #about-title. */
const TITLE_ID_SUFFIX = titleId("");

/** A thread's id is its tab's, so it can't be one of the page's own parts',
    start as the ids the page and the script make up do ("chat-1",
    "group-work"), or be another tab's title's ("about-title"). */
const isUsedByThePage = (id: string): boolean =>
  IDS_OF_THE_PAGES_OWN_PARTS.includes(id) ||
  ID_PREFIXES.some((prefix) => id.startsWith(prefix)) ||
  id.endsWith(TITLE_ID_SUFFIX);

const checkThreads: LanguageCheck = (checks) => {
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
};

/** A logo's badge isn't drawn in the sidebar, so a row there needs one of
    the stylesheet's icons. */
const checkSidebarRows: LanguageCheck = ({ language, checkIsThread, checkIsIcon }) => {
  for (const row of language.sidebar.nav) {
    checkIsThread(row.tab, `the sidebar's "${row.label}"`);
    checkIsIcon(row.icon, `the sidebar's "${row.label}"`);
  }
};

/** A group's heading has an id made from the group's ("group-work"), and
    the script gives the visitor's own chats the group CHATS_GROUP. */
const checkSidebarGroups: LanguageCheck = ({ language, problemUnless, checkIsThread }) => {
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
};

const checkPanel: LanguageCheck = ({ language, checkIsThread, checkIsIconOrLogo, checkLinkIsSafe }) => {
  for (const step of language.panel.progress?.steps ?? []) checkIsThread(step.tab, `the panel's "${step.title}"`);
  for (const row of panelRows(language.panel)) {
    checkIsIconOrLogo(row.icon, `the panel's "${row.label}"`);
    if (row.href != null) checkLinkIsSafe(row.href, `the panel's "${row.label}"`);
  }
};

const checkTopics: LanguageCheck = ({ language, problemUnless, checkIsThread }) => {
  for (const topic of language.questions.topics) {
    const thisTopic = `the question card's "${topic.label}"`;
    if (topic.tab) checkIsThread(topic.tab, thisTopic);
    for (const choice of topic.choices ?? []) checkIsThread(choice.tab, thisTopic);
    const opensSomething = Boolean(topic.tab || topic.personal || topic.choices?.length);
    problemUnless(opensSomething, `${thisTopic} opens nothing`);
    const opensThreadOrAsksWhich = Boolean(topic.tab || topic.ask);
    problemUnless(opensThreadOrAsksWhich, `${thisTopic} needs an "ask" for its second question`);
  }
};

/** A personal answer's tab is #personal-<id>, and its answer
    "personal-<id>.1", which the script reads back as that tab's id. */
const checkPersonalAnswerIds: LanguageCheck = ({ language, problemUnless }) => {
  const ids = language.questions.personal.map((personalAnswer) => personalAnswer.id);
  problemUnless(areAllDifferent(ids), "two personal answers have the same id");
  for (const id of ids) {
    problemUnless(looksLikeAnId(id), `the personal answer id "${id}" should be lowercase letters, digits and dashes`);
  }
};

const checkUpgradeRow: LanguageCheck = ({ language, checkIsThread }) => {
  checkIsThread(language.account.upgrade.tab, "the account menu's upgrade row");
};

/** In the order their problems are listed. */
export const PARTS_CHECKS: LanguageCheck[] = [
  checkLocale,
  checkPreloadedFonts,
  checkHomePrompts,
  checkThreads,
  checkSidebarRows,
  checkSidebarGroups,
  checkPanel,
  checkTopics,
  checkPersonalAnswerIds,
  checkUpgradeRow,
];
