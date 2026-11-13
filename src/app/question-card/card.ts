/* The question card, over the composer of the tab you're in: topics that
   open a tab (or first ask which), and a box for a question of your own.
   In a chat a choice is sent as a message; elsewhere it opens its tab.
   There's one card: it moves to the composer it's opened from. */
import { MAX_QUESTION_LENGTH } from "../../contracts/ask.ts";
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { PAGE_IDS } from "../../contracts/page-ids.ts";
import { CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { threadChoice, typedQuestion, type Exchange } from "../conversation/exchange.ts";
import { firstQuestionOf } from "../conversation/page-answers.ts";
import { send } from "../conversation/send.ts";
import { asButton, find, findAll, make, onEnter, parentOf } from "../lib/dom.ts";
import { stepFocus } from "../lib/focus.ts";
import {
  closePopup,
  closePopupAndReturnFocus,
  isPopupOpenFrom,
  openPopup,
  popupAttributes,
  togglePopup,
} from "../popup.ts";
import { isChat, rowFor } from "../tabs.ts";
import { cardChoices, holdsTab, type CardChoice, type TabChoice, type TabOnPage, type TopicGroup } from "./choices.ts";
import { questionCard } from "./data.ts";
import { actionForKey, type CardKeyAction } from "./keys.ts";

const cardWords = questionCard.ui;

const card = make("div", {
  class: "ask follow-card",
  id: PAGE_IDS.questionCard,
  role: "dialog",
  "aria-label": cardWords.followUp,
  hidden: "",
});
const backButton = make("button", {
  type: "button",
  class: "icon-button icon i-left",
  "aria-label": cardWords.back,
  title: cardWords.back,
});
/** Shown with a topic's tabs, which are always the second step of two. */
const secondStepOfTwo = cardWords.step.replace("{n}", "2").replace("{total}", "2");
const stepPager = make("div", { class: "pager" }, backButton, make("span", { class: "count" }, secondStepOfTwo));
const cardQuestion = make("h2");
const choiceList = make("ol", { class: PAGE_CLASSES.options });
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

/** The card's first step: a choice for each topic. Built by initCard. */
let topicChoices: CardChoice[] = [];
/** The topic whose tabs are listed; null while the topics are. */
let openGroup: TopicGroup | null = null;
/** The tab the card was opened in: what's chosen or typed is sent there. */
let cardTab: HTMLElement | null = null;

/** What the page has for a tab, to name its choice by; null, with a
    warning, for an id that names no tab. */
function tabOnPage(tabId: string): TabOnPage | null {
  const tab = document.getElementById(tabId);
  if (!tab?.matches(CLASS_SELECTOR.tab)) {
    console.warn(`site.config: there's no tab #${tabId}`);
    return null;
  }
  const sidebarRow = rowFor(tabId);
  const rowName = (sidebarRow?.querySelector(CLASS_SELECTOR.rowName) ?? sidebarRow)?.textContent.trim();
  return {
    name: rowName ?? find(tab, CLASS_SELECTOR.title).textContent,
    rowHint: sidebarRow?.querySelector(CLASS_SELECTOR.rowHint)?.textContent.trim(),
    firstQuestion: firstQuestionOf(tabId),
  };
}

/** The links and buttons of the choices listed now, in order. */
const choiceControls = (): HTMLElement[] => findAll(choiceList, "a, button");

const focusFirstChoice = (): void => choiceControls()[0]?.focus();

/** Sends what was chosen or typed into the tab the card was opened in, and
    closes the card. */
function sendFromCard(exchange: Exchange): void {
  closePopupAndReturnFocus();
  if (cardTab) void send(cardTab, exchange);
}

/** What a choice shows: its number (the key that picks it), its label and
    hint, and a check on the choice that holds the tab you're in, as a menu
    checks the current choice. */
function choiceParts(choice: CardChoice, number: number): HTMLElement[] {
  const parts = [
    make("span", { class: "option-number", "aria-hidden": "true" }, String(number)),
    make(
      "span",
      { class: PAGE_CLASSES.rowWords },
      make("span", { class: PAGE_CLASSES.optionLabel }, choice.label),
      make("span", { class: "option-hint" }, choice.hint),
    ),
  ];
  const holdsCardTab = cardTab !== null && holdsTab(choice, cardTab.id);
  if (holdsCardTab) parts.push(make("span", { class: "on", "aria-hidden": "true" }));
  return parts;
}

/** A topic with several tabs is a button, which lists them. */
function topicGroupButton(group: TopicGroup, parts: HTMLElement[]): HTMLElement {
  const button = make("button", { type: "button" }, ...parts);
  button.addEventListener("click", () => {
    listTabsOf(group);
    focusFirstChoice();
  });
  return button;
}

/** A tab is a link to it. Outside a chat that's all it is: the card closes
    and the tab opens. In a chat, the tab's thread is sent as a message
    instead. */
function tabChoiceLink(choice: TabChoice, parts: HTMLElement[]): HTMLElement {
  const isCardTab = choice.tabId === cardTab?.id;
  const link = make("a", { href: `#${choice.tabId}`, "aria-current": isCardTab ? "page" : null }, ...parts);
  link.addEventListener("click", (event) => {
    if (!cardTab || !isChat(cardTab)) return closePopup();
    event.preventDefault();
    sendFromCard(threadChoice(choice.tabId));
  });
  return link;
}

/** One choice in the list, numbered from 1. */
function choiceItem(choice: CardChoice, number: number): HTMLElement {
  const parts = choiceParts(choice, number);
  return make("li", {}, choice.kind === "group" ? topicGroupButton(choice, parts) : tabChoiceLink(choice, parts));
}

function list(choices: CardChoice[]): void {
  choiceList.replaceChildren(...choices.map((choice, index) => choiceItem(choice, index + 1)));
}

/** The card's first step. */
function listTopics(): void {
  openGroup = null;
  cardQuestion.textContent = questionCard.ask;
  stepPager.hidden = true;
  list(topicChoices);
}

/** One topic's tabs, under the topic's own question, with the way back. */
function listTabsOf(group: TopicGroup): void {
  openGroup = group;
  cardQuestion.textContent = group.question;
  stepPager.hidden = false;
  list(group.tabChoices);
}

function backToTopics(): void {
  listTopics();
  focusFirstChoice();
}

/** Sends the question typed into the card's box, and empties the box. With
    nothing typed, the cursor goes to the box instead. */
function sendOwnQuestion(): void {
  const question = ownQuestionInput.value.trim();
  if (!question) return ownQuestionInput.focus();
  ownQuestionInput.value = "";
  sendFromCard(typedQuestion(question));
}

/** Once the first letter is in the box, the rest follows it there. */
function typeIntoOwnQuestion(character: string): void {
  ownQuestionInput.value += character;
  ownQuestionInput.focus();
  const end = ownQuestionInput.value.length;
  ownQuestionInput.setSelectionRange(end, end);
}

/** Where the arrow keys stop: each choice, then the box. */
const arrowKeyStops = (): HTMLElement[] => [...choiceControls(), ownQuestionInput];

function doKeyAction(action: CardKeyAction): void {
  if (action.kind === "type") typeIntoOwnQuestion(action.character);
  else if (action.kind === "pick") choiceControls()[action.choiceNumber - 1]?.click();
  else if (action.kind === "back") backToTopics();
  else stepFocus(arrowKeyStops(), action.by);
}

function onCardKey(event: KeyboardEvent): void {
  const isTheBoxsOwn = event.target === ownQuestionInput;
  const isTheBrowsersShortcut = event.altKey || event.ctrlKey || event.metaKey;
  if (isTheBoxsOwn || isTheBrowsersShortcut) return;
  const action = actionForKey(event.key, openGroup !== null);
  if (!action) return;
  doKeyAction(action);
  event.preventDefault();
}

/** How the card opens over a tab's composer: in that tab, listing the
    topics. */
function cardOpening(composer: HTMLElement, tab: HTMLElement): { prepare: () => void } {
  return {
    prepare() {
      cardTab = tab;
      listTopics();
      parentOf(composer).append(card);
    },
  };
}

const firstChoice = (): HTMLElement | undefined => choiceControls()[0];

/** A tab's composer: a press opens the card over it, or closes the card if
    that's where it's open. */
export function wireComposer(composer: HTMLElement, tab: HTMLElement): void {
  asButton(composer, popupAttributes(PAGE_IDS.questionCard, "dialog"));
  composer.addEventListener("click", (event) => {
    event.preventDefault();
    togglePopup(card, composer, { ...cardOpening(composer, tab), firstFocus: firstChoice });
  });
}

/** Opens the card in a tab, with focus on its first choice. One that's
    open there already is left as it is. */
export function openCard(tab: HTMLElement): void {
  const composer = find(tab, CLASS_SELECTOR.composer);
  if (isPopupOpenFrom(composer)) return;
  openPopup(card, composer, { ...cardOpening(composer, tab), firstFocus: firstChoice });
}

/** Opens the card in a tab and leaves focus where it is: a visit that
    starts with the card open hasn't touched anything yet. */
export function openCardLeavingFocus(tab: HTMLElement): void {
  const composer = find(tab, CLASS_SELECTOR.composer);
  openPopup(card, composer, cardOpening(composer, tab));
}

/** Builds the card. Its choices are named from the sidebar, so this comes
    after the personal tabs are made and before a renamed tab renames its row. */
export function initCard(): void {
  topicChoices = cardChoices(questionCard, tabOnPage);
  const ownQuestionRow = make(
    "p",
    { class: "ask-else" },
    make("span", { class: "option-number icon i-pen", "aria-hidden": "true" }),
    ownQuestionInput,
    sendButton,
  );
  card.replaceChildren(stepPager, cardQuestion, choiceList, ownQuestionRow);
  backButton.addEventListener("click", backToTopics);
  sendButton.addEventListener("click", sendOwnQuestion);
  onEnter(ownQuestionInput, sendOwnQuestion);
  card.addEventListener("keydown", onCardKey);
}
