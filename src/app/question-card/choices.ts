/* The question card's choices, worked out from the card's data: a choice
   opens a tab, or is a topic that lists several. It needs no page: what
   the page has for a tab comes through a TabLookup. */
import type { PersonalAnswer, QuestionCard, TabTopic, Topic } from "../../config/question-card.ts";
import { personalTabId } from "../../contracts/page-ids.ts";

/** A choice that opens a tab (in a chat, it sends that tab's thread). */
export type TabChoice = {
  kind: "tab";
  tabId: string;
  label: string;
  /** The smaller line under the label. */
  hint: string;
};

/** A topic with several tabs: choosing it asks which, and lists them. */
export type TopicGroup = {
  kind: "group";
  label: string;
  hint: string;
  /** What the card asks while it lists this topic's tabs. */
  question: string;
  tabChoices: TabChoice[];
};

export type CardChoice = TabChoice | TopicGroup;

/** What the page has for a tab, to name a choice by. */
export type TabOnPage = {
  /** Its name on its sidebar row, or else its title. */
  name: string;
  /** Its sidebar row's second line, if it has a row with one. */
  rowHint: string | undefined;
  firstQuestion: string | null;
};

/** Null for an id that names no tab. */
export type TabLookup = (tabId: string) => TabOnPage | null;

type Naming = { label?: string | undefined; hint?: string | undefined };

/** A choice for a tab. What it isn't given is the page's: its label the
    tab's name, its hint the row's second line or else the tab's first
    question. Null for a tab the page hasn't. */
function tabChoice(tabId: string, { label, hint }: Naming, tabOnPage: TabLookup): TabChoice | null {
  const tab = tabOnPage(tabId);
  if (!tab) return null;
  return {
    kind: "tab",
    tabId,
    label: label ?? tab.name,
    hint: hint ?? tab.rowHint ?? tab.firstQuestion ?? "",
  };
}

/** A topic that opens a tab at once, under the topic's own name. Its hint
    is its tab's first question before the row's second line. */
function tabTopicChoice({ tab: tabId, label, hint }: TabTopic, tabOnPage: TabLookup): TabChoice | null {
  const tab = tabOnPage(tabId);
  return tab && { kind: "tab", tabId, label, hint: hint ?? tab.firstQuestion ?? tab.rowHint ?? "" };
}

const personalChoices = (personal: PersonalAnswer[], tabOnPage: TabLookup): Array<TabChoice | null> =>
  personal
    .filter((answer) => !answer.hidden)
    .map((answer) => tabChoice(personalTabId(answer.id), { label: answer.q, hint: answer.hint }, tabOnPage));

/** A topic that asks which: the personal answers that aren't hidden, or
    the tabs the config gives it. A topic left with a single tab opens it,
    under the topic's own name; one left with none isn't in the card. */
function listingTopicChoice(topic: Topic, personal: PersonalAnswer[], tabOnPage: TabLookup): CardChoice | null {
  const listed = topic.personal
    ? personalChoices(personal, tabOnPage)
    : (topic.choices ?? []).map((choice) => tabChoice(choice.tab, choice, tabOnPage));
  const tabChoices = listed.filter((choice) => choice !== null);
  const [onlyChoice] = tabChoices;
  if (!onlyChoice) return null;
  if (tabChoices.length === 1) return { ...onlyChoice, label: topic.label };
  return {
    kind: "group",
    label: topic.label,
    hint: topic.hint ?? tabChoices.map((choice) => choice.label).join(", "),
    question: topic.ask ?? "",
    tabChoices,
  };
}

/** The card's first step: a choice for each topic that has something to
    open. */
export function cardChoices({ topics, personal }: QuestionCard, tabOnPage: TabLookup): CardChoice[] {
  return topics
    .map((topic) => (topic.tab ? tabTopicChoice(topic, tabOnPage) : listingTopicChoice(topic, personal, tabOnPage)))
    .filter((choice) => choice !== null);
}

/** Whether a choice opens a tab, or lists it. */
export function holdsTab(choice: CardChoice, tabId: string): boolean {
  if (choice.kind === "tab") return choice.tabId === tabId;
  return choice.tabChoices.some((tabChoice) => tabChoice.tabId === tabId);
}
