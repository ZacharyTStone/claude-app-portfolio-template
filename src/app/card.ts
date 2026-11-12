/* The question card, over the composer of the tab you're in: topics that
   open a tab (or first ask which), and a box for a question of your own.
   In a chat a choice is sent as a message; elsewhere it opens its tab. */
import { MAX_QUESTION_LENGTH } from "../shared/ask.ts";
import { PAGE_IDS, personalTab, type Topic } from "../shared/page-data.ts";
import { CLASS, SELECTOR } from "./constants.ts";
import { asButton, find, findAll, make, onEnter, parentOf } from "./lib/dom.ts";
import { stepFocus } from "./lib/focus.ts";
import { closeMenu, popupAttributes, toggleMenu } from "./menus.ts";
import { questionCard } from "./page.ts";
import { questionFor, type Source } from "./replies.ts";
import { send } from "./send.ts";
import { isChat, rowFor } from "./tabs.ts";

// ---- The card's choices ------------------------------------------------------------

/** A choice that opens a tab (in a chat, it sends that tab's thread). */
type TabChoice = {
  kind: "tab";
  tabId: string;
  label: string;
  /** The smaller line under the label. */
  hint: string;
};

/** A topic with several tabs: choosing it asks which, and lists them. */
type TopicGroup = {
  kind: "group";
  label: string;
  hint: string;
  /** What the card asks while it lists this topic's tabs. */
  question: string;
  tabChoices: TabChoice[];
};

/** One of the card's choices. */
type CardChoice = TabChoice | TopicGroup;

/** A choice for a tab. Unless it's given them, its label is the tab's name
    on its sidebar row (or else the tab's title), and its hint the row's
    second line (or else the tab's first question). Null, with a warning,
    for an id that names no tab. */
function tabChoice(tabId: string, label?: string, hint?: string): TabChoice | null {
  const tab = document.getElementById(tabId);
  if (!tab?.matches(SELECTOR.tab)) {
    console.warn(`site.config: there's no tab #${tabId}`);
    return null;
  }
  const sidebarRow = rowFor(tabId);
  const rowName = (sidebarRow?.querySelector(SELECTOR.rowName) ?? sidebarRow)?.textContent.trim();
  const rowHint = sidebarRow?.querySelector(SELECTOR.rowHint)?.textContent.trim();
  return {
    kind: "tab",
    tabId,
    label: label ?? rowName ?? find(tab, SELECTOR.title).textContent,
    hint: hint ?? rowHint ?? questionFor({ tab: tabId }) ?? "",
  };
}

/** The tabs a topic lists: the personal answers that aren't hidden, or the
    tabs the config gives it. One whose tab the page doesn't have is left
    out. */
function tabChoicesOf(topic: Topic): TabChoice[] {
  const choices = topic.personal
    ? questionCard.personal
        .filter((personal) => !personal.hidden)
        .map((personal) => tabChoice(personalTab(personal.id), personal.q, personal.hint))
    : (topic.choices ?? []).map((choice) => tabChoice(choice.tab, choice.label, choice.hint));
  return choices.filter((choice) => choice !== null);
}

/** A topic as one of the card's choices: one that opens its tab, or, for a
    topic with several tabs, one that asks which. A topic left with a
    single tab opens it, under the topic's own name; a topic left with none
    isn't in the card. */
function topicChoice(topic: Topic): CardChoice | null {
  if (topic.tab) {
    // A topic's hint is its tab's first question, not the row's second line.
    const hint = topic.hint ?? questionFor({ tab: topic.tab }) ?? undefined;
    return tabChoice(topic.tab, topic.label, hint);
  }
  const tabChoices = tabChoicesOf(topic);
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

// ---- The card's parts --------------------------------------------------------------
// Made as this file loads, and put together by initCard. There's one card:
// it moves to the composer it's opened from.

const cardWords = questionCard.ui;

const card = make("div", {
  class: "ask follow-card",
  id: PAGE_IDS.followUp,
  role: "dialog",
  "aria-label": cardWords.followUp,
  hidden: "",
});
const backButton = make("button", {
  type: "button",
  class: "icon-btn ic i-left",
  "aria-label": cardWords.back,
  title: cardWords.back,
});
// Shown with a topic's tabs, which are always the second step of two.
const secondStepOfTwo = cardWords.step.replace("{n}", "2").replace("{total}", "2");
const stepPager = make("div", { class: "pager" }, backButton, make("span", { class: "count" }, secondStepOfTwo));
const cardQuestion = make("h2");
const choiceList = make("ol", { class: CLASS.options });
const ownQuestionInput = make("input", {
  type: "text",
  class: "else-input",
  placeholder: cardWords.else,
  "aria-label": cardWords.elseLabel,
  maxlength: String(MAX_QUESTION_LENGTH),
  autocomplete: "off",
  enterkeyhint: "send",
});
const sendButton = make("button", { type: "button", class: "ask-send" }, cardWords.send);

// ---- What the card is showing ------------------------------------------------------

/** The card's first step: a choice for each topic. Built by initCard. */
let topicChoices: CardChoice[] = [];
/** The topic whose tabs are listed; null while the topics are. */
let openGroup: TopicGroup | null = null;
/** The tab the card was opened in: what's chosen or typed is sent there. */
let cardTab: HTMLElement | null = null;

/** The links and buttons of the choices listed now, in order. */
const choiceControls = (): HTMLElement[] => findAll(choiceList, "a, button");

/** Sends what was chosen or typed into the tab the card was opened in, and
    closes the card. */
function sendFromCard(source: Source): void {
  closeMenu({ refocus: true });
  if (cardTab) send(cardTab, source);
}

/** Whether a choice is the tab the card was opened in, or holds it. */
function holdsCardTab(choice: CardChoice): boolean {
  const cardTabId = cardTab?.id;
  if (!cardTabId) return false;
  if (choice.kind === "tab") return choice.tabId === cardTabId;
  return choice.tabChoices.some((choiceInGroup) => choiceInGroup.tabId === cardTabId);
}

/** What a choice shows: its number (the key that picks it), its label and
    hint, and a check on the choice that holds the tab you're in, as a menu
    checks the current choice. */
function choiceParts(choice: CardChoice, number: number): HTMLElement[] {
  const parts = [
    make("span", { class: "n", "aria-hidden": "true" }, String(number)),
    make(
      "span",
      { class: "opt" },
      make("span", { class: CLASS.optionLabel }, choice.label),
      make("span", { class: "opt-d" }, choice.hint),
    ),
  ];
  if (holdsCardTab(choice)) parts.push(make("span", { class: "on", "aria-hidden": "true" }));
  return parts;
}

/** A topic with several tabs is a button, which lists them. */
function topicGroupButton(group: TopicGroup, parts: HTMLElement[]): HTMLElement {
  const button = make("button", { type: "button" }, ...parts);
  button.addEventListener("click", () => listChoices(group, { moveFocus: true }));
  return button;
}

/** A tab is a link to it. Outside a chat that's all it is: the card closes
    and the tab opens. In a chat, the tab's thread is sent as a message
    instead. */
function tabChoiceLink(choice: TabChoice, parts: HTMLElement[]): HTMLElement {
  const isCardTab = choice.tabId === cardTab?.id;
  const link = make("a", { href: `#${choice.tabId}`, "aria-current": isCardTab ? "page" : null }, ...parts);
  link.addEventListener("click", (event) => {
    if (!cardTab || !isChat(cardTab)) return closeMenu();
    event.preventDefault();
    sendFromCard({ tab: choice.tabId });
  });
  return link;
}

/** One choice in the list, numbered from 1. */
function choiceItem(choice: CardChoice, number: number): HTMLElement {
  const parts = choiceParts(choice, number);
  return make("li", {}, choice.kind === "group" ? topicGroupButton(choice, parts) : tabChoiceLink(choice, parts));
}

/** Lists the topics (given null), or one topic's tabs under its own
    question, with the way back. With `moveFocus`, focus goes to the first
    choice. */
function listChoices(group: TopicGroup | null, { moveFocus }: { moveFocus: boolean }): void {
  openGroup = group;
  cardQuestion.textContent = group ? group.question : questionCard.ask;
  stepPager.hidden = !group;
  const listed = group ? group.tabChoices : topicChoices;
  choiceList.replaceChildren(...listed.map((choice, index) => choiceItem(choice, index + 1)));
  if (moveFocus) choiceControls()[0]?.focus();
}

/** Sends the question typed into the card's box, and empties the box. With
    nothing typed, the cursor goes to the box instead. */
function sendOwnQuestion(): void {
  const question = ownQuestionInput.value.trim();
  if (!question) return ownQuestionInput.focus();
  ownQuestionInput.value = "";
  sendFromCard({ question });
}

// ---- The card's keys ---------------------------------------------------------------

/** A choice's number, "1" to "9": the key that picks it. */
const NUMBER_KEY = /^[1-9]$/;
const isNumberKey = (key: string): boolean => NUMBER_KEY.test(key);

/** Whether a key types a character for the box: any one character (a key
    such as "Enter" has a longer name), but for a choice's number, which
    picks that choice, and the space, which presses the choice that has
    focus as it does any button. */
const isForOwnQuestion = (key: string): boolean => key.length === 1 && key !== " " && !isNumberKey(key);

/** Typing goes into "Ask your own question", as it would into a composer,
    instead of being lost on the choice that has focus (or pressing it).
    Once the first letter is in the box, the rest follows it there. */
function typeIntoOwnQuestion(character: string): void {
  ownQuestionInput.value += character;
  ownQuestionInput.focus();
  const end = ownQuestionInput.value.length;
  ownQuestionInput.setSelectionRange(end, end);
}

/** Where the arrow keys stop: each choice, then the box. */
const arrowKeyStops = (): HTMLElement[] => [...choiceControls(), ownQuestionInput];

function onCardKey(event: KeyboardEvent): void {
  // A key pressed in the box is the box's own; with Alt, Ctrl or Cmd held
  // it's a shortcut of the browser's.
  if (event.target === ownQuestionInput || event.altKey || event.ctrlKey || event.metaKey) return;
  const { key } = event;
  if (isForOwnQuestion(key)) typeIntoOwnQuestion(key);
  else if (isNumberKey(key)) choiceControls()[Number(key) - 1]?.click();
  else if (key === "ArrowLeft" && openGroup) listChoices(null, { moveFocus: true });
  else if (key === "ArrowDown") stepFocus(arrowKeyStops(), 1);
  else if (key === "ArrowUp") stepFocus(arrowKeyStops(), -1);
  else return;
  event.preventDefault();
}

// ---- Opening it --------------------------------------------------------------------

/** Opens the card over a tab's composer (or closes it, if that's where
    it's open). Its first choice gets focus, unless `moveFocus` is off: a
    visit that starts with the card open hasn't touched anything yet. */
export function toggleCard(
  composer: HTMLElement,
  tab: HTMLElement,
  { moveFocus = true }: { moveFocus?: boolean } = {},
): void {
  toggleMenu(card, composer, {
    prepare() {
      cardTab = tab;
      listChoices(null, { moveFocus: false });
      parentOf(composer).append(card);
    },
    firstFocus: () => (moveFocus ? choiceControls()[0] : undefined),
  });
}

/** A tab's composer: it opens the card, over itself. */
export function wireComposer(composer: HTMLElement, tab: HTMLElement): void {
  asButton(composer, popupAttributes(PAGE_IDS.followUp, "dialog"));
  composer.addEventListener("click", (event) => {
    event.preventDefault();
    toggleCard(composer, tab);
  });
}

/** Builds the card. Its choices are named from the sidebar, so this comes
    after the personal tabs are made and before a renamed tab renames its row. */
export function initCard(): void {
  topicChoices = questionCard.topics.map(topicChoice).filter((choice) => choice !== null);
  const ownQuestionRow = make(
    "p",
    { class: "ask-else" },
    make("span", { class: "n ic i-pen", "aria-hidden": "true" }),
    ownQuestionInput,
    sendButton,
  );
  card.replaceChildren(stepPager, cardQuestion, choiceList, ownQuestionRow);
  backButton.addEventListener("click", () => listChoices(null, { moveFocus: true }));
  sendButton.addEventListener("click", sendOwnQuestion);
  onEnter(ownQuestionInput, sendOwnQuestion);
  card.addEventListener("keydown", onCardKey);
}
