/* The checks' advice: printed as a build starts, which then goes ahead. */

import type { Language } from "../../config/language.ts";
import type { Site } from "../site.ts";
import { tabsLinkedFromTheText } from "./text-links.ts";

type Advice = (site: Site) => string[];

/** The question card's first step reads best with this many topics or
    fewer (plus "Something else"), on a phone above all. */
const MAX_TOPICS = 4;

/** The main language's count is every language's: the languages match. */
const adviseOnManyTopics: Advice = (site) => {
  const topicCount = site.language(site.main).questions.topics.length;
  if (topicCount <= MAX_TOPICS) return [];
  return [
    `the question card has ${topicCount} topics. ${MAX_TOPICS} or fewer read better, on a phone above all: group the rest under one topic with "ask" and "choices"`,
  ];
};

/** The threads something on a language's page opens. */
function threadsOpenedIn({ sidebar, panel, questions, account }: Language): Array<string | undefined> {
  return [
    ...sidebar.nav.map((row) => row.tab),
    ...sidebar.groups.flatMap((group) => group.tabs.map((row) => row.tab)),
    ...(panel.progress?.steps ?? []).map((step) => step.tab),
    ...questions.topics.flatMap((topic) => [topic.tab, ...(topic.choices ?? []).map((choice) => choice.tab)]),
    account.upgrade.tab,
  ];
}

/** A thread builds without a row in the sidebar, and may be meant to: but
    one added and never linked is a tab no visitor will find. */
const adviseOnThreadsNothingOpens: Advice = (site) =>
  site.codes.flatMap((code) => {
    const language = site.language(code);
    const opened = new Set([...threadsOpenedIn(language), ...tabsLinkedFromTheText(language)]);
    return language.threads
      .filter((thread) => !opened.has(thread.id))
      .map(
        ({ id }) =>
          `${code}: nothing opens the thread "${id}": no sidebar row, panel step, topic or link in the text points at #${id}, so a visitor finds it only by its address`,
      );
  });

/** In the order the advice is printed. */
export const ADVICE: Advice[] = [adviseOnManyTopics, adviseOnThreadsNothingOpens];
