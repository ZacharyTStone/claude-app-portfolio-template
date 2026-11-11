/* The question card, over the composer of the tab you're in: topics that
   open a tab (or first ask which), and a box for a question of your own.
   In a chat a choice is sent as a message; elsewhere it opens its tab. */
import { MAX_QUESTION_LENGTH } from "../shared/ask.ts";
import { PAGE_IDS, personalTab, type Topic } from "../shared/page-data.ts";
import { CLASS, SELECTOR } from "./constants.ts";
import { asButton, find, findAll, make, onEnter, parentOf } from "./lib/dom.ts";
import { closeMenu, popupAttributes, toggleMenu } from "./menus.ts";
import { questions } from "./page.ts";
import { questionFor, type Source } from "./replies.ts";
import { send } from "./send.ts";
import { isChat, rowFor } from "./tabs.ts";

/** A choice that opens a tab. */
type Option = { href: string; label: string; hint: string };
/** A topic that asks which tab first. */
type Group = { label: string; hint: string; ask: string; items: Option[] };
type Entry = Option | Group;

const ui = questions.ui;

// A choice for a tab. A topic's hint is its tab's first question; a choice
// inside a topic is named after the tab's row in the sidebar.
function tabChoice(id: string, label?: string, hint?: string): Option | null {
  const tab = document.getElementById(id);
  if (!tab?.matches(SELECTOR.tab)) {
    console.warn(`site.config: there's no tab #${id}`);
    return null;
  }
  const row = rowFor(id);
  return {
    href: `#${id}`,
    label:
      label ??
      (row?.querySelector(SELECTOR.rowName) ?? row)?.textContent.trim() ??
      find(tab, SELECTOR.title).textContent,
    hint: hint ?? row?.querySelector(SELECTOR.rowHint)?.textContent.trim() ?? questionFor({ tab: id }) ?? "",
  };
}

function topicEntry(topic: Topic): Entry | null {
  if (topic.tab) return tabChoice(topic.tab, topic.label, topic.hint ?? questionFor({ tab: topic.tab }) ?? undefined);
  const items = (
    topic.personal
      ? questions.personal
          .filter((item) => !item.hidden)
          .map((item) => tabChoice(personalTab(item.id), item.q, item.hint))
      : (topic.choices ?? []).map((choice) => tabChoice(choice.tab, choice.label, choice.hint))
  ).filter((item) => item !== null);
  const [only] = items;
  if (!only) return null;
  if (items.length === 1) return { ...only, label: topic.label };
  return {
    label: topic.label,
    hint: topic.hint ?? items.map((item) => item.label).join(", "),
    ask: topic.ask ?? "",
    items,
  };
}

// ---- The card ----------------------------------------------------------------------

const card = make("div", {
  class: "ask follow-card",
  id: PAGE_IDS.followUp,
  role: "dialog",
  "aria-label": ui.followUp,
  hidden: "",
});
const back = make("button", { type: "button", class: "icon-btn ic i-left", "aria-label": ui.back, title: ui.back });
// Shown with a topic's tabs, which are always the second step of two.
const pager = make(
  "div",
  { class: "pager" },
  back,
  make("span", { class: "count" }, ui.step.replace("{n}", "2").replace("{total}", "2")),
);
const title = make("h2");
const list = make("ol", { class: CLASS.options });
const input = make("input", {
  type: "text",
  class: "else-input",
  placeholder: ui.else,
  "aria-label": ui.elseLabel,
  maxlength: String(MAX_QUESTION_LENGTH),
  autocomplete: "off",
  enterkeyhint: "send",
});
const askButton = make("button", { type: "button", class: "ask-send" }, ui.send);

let topics: Entry[] = [];
// The topic whose tabs are listed (null for the topics), the tab the card
// was opened in, and its address.
let topic: Group | null = null;
let cardTab: HTMLElement | null = null;
let here: string | null = null;

const choices = (): HTMLElement[] => findAll(list, "a, button");
// A choice's number, which picks it.
const isNumberKey = (key: string) => /^[1-9]$/.test(key);

// Sends what was chosen into the tab the card was opened in.
function sendChoice(source: Source): void {
  closeMenu(true);
  if (cardTab) send(cardTab, source);
}

function option(entry: Entry, n: number): HTMLElement {
  const parts = [
    make("span", { class: "n", "aria-hidden": "true" }, String(n)),
    make(
      "span",
      { class: "opt" },
      make("span", { class: CLASS.optionLabel }, entry.label),
      make("span", { class: "opt-d" }, entry.hint),
    ),
  ];
  const holdsHere = "items" in entry ? entry.items.some((item) => item.href === here) : entry.href === here;
  // A check on the choice that holds the tab you're in, as a menu checks
  // the current choice.
  if (here && holdsHere) parts.push(make("span", { class: "on", "aria-hidden": "true" }));
  if ("items" in entry) {
    const control = make("button", { type: "button" }, ...parts);
    control.addEventListener("click", () => show(entry, true));
    return make("li", {}, control);
  }
  const control = make("a", { href: entry.href, "aria-current": entry.href === here ? "page" : null }, ...parts);
  control.addEventListener("click", (event) => {
    // Outside a chat it's a link: the card closes and the tab opens.
    if (!cardTab || !isChat(cardTab)) return closeMenu(false);
    event.preventDefault();
    sendChoice({ tab: entry.href.slice(1) });
  });
  return make("li", {}, control);
}

function show(next: Group | null, moveFocus: boolean): void {
  topic = next;
  title.textContent = topic ? topic.ask : questions.ask;
  pager.hidden = !topic;
  list.replaceChildren(...(topic ? topic.items : topics).map((entry, i) => option(entry, i + 1)));
  if (moveFocus) choices()[0]?.focus();
}

function submit(): void {
  const question = input.value.trim();
  if (!question) return input.focus();
  input.value = "";
  sendChoice({ question });
}

function onKey(event: KeyboardEvent): void {
  if (event.target === input || event.altKey || event.ctrlKey || event.metaKey) return;
  // Typing goes into "Ask your own question", as it would into a
  // composer, instead of being lost on the choice that has focus (or
  // pressing it). A space still presses a choice, as it does any button;
  // once the first letter is in the box, the rest follows it there.
  if (event.key.length === 1 && event.key !== " " && !isNumberKey(event.key)) {
    event.preventDefault();
    input.value += event.key;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    return;
  }
  const stops = [...choices(), input];
  const at = stops.findIndex((stop) => stop === document.activeElement);
  if (isNumberKey(event.key)) choices()[Number(event.key) - 1]?.click();
  else if (event.key === "ArrowLeft" && topic) show(null, true);
  else if (event.key === "ArrowDown") stops[(at + 1) % stops.length]?.focus();
  else if (event.key === "ArrowUp") stops[(at - 1 + stops.length) % stops.length]?.focus();
  else return;
  event.preventDefault();
}

/** Opens the card over a tab's composer (or closes it, if that's where
    it's open). Its first choice gets focus, unless `moveFocus` is off: a
    visit that starts with the card open hasn't touched anything yet. */
export function toggleCard(composer: HTMLElement, tab: HTMLElement, moveFocus = true): void {
  toggleMenu(card, composer, {
    build() {
      cardTab = tab;
      here = `#${tab.id}`;
      show(null, false);
      parentOf(composer).append(card);
    },
    focus: () => (moveFocus ? choices()[0] : undefined),
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
  topics = questions.topics.map(topicEntry).filter((entry) => entry !== null);
  card.replaceChildren(
    pager,
    title,
    list,
    make("p", { class: "ask-else" }, make("span", { class: "n ic i-pen", "aria-hidden": "true" }), input, askButton),
  );
  back.addEventListener("click", () => show(null, true));
  askButton.addEventListener("click", submit);
  onEnter(input, submit);
  card.addEventListener("keydown", onKey);
}
