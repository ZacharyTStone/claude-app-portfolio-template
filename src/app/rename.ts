/* Renaming a tab: its title (or Rename in its menus) becomes a box to type
   a new name in. The name shows on its sidebar row too, and is remembered
   per browser and language. A chat keeps its own name (chats.ts). */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { find, isComposing, make } from "./lib/dom.ts";
import { local } from "./lib/storage.ts";
import { renameChat } from "./chats.ts";
import { root, words } from "./page.ts";
import { givenNameFrom, givenNamesIn, rowTextFor } from "./tab-names.ts";
import { currentTab, isChat, rowFor, setTitle } from "./tabs.ts";

/** In localStorage, per language. */
const NAMES_KEY = `portfolio:names:${root.lang}`;

/** In characters. */
const LONGEST_NAME = 60;
const NARROWEST_NAME_BOX = 6;

const givenNames = givenNamesIn(local.getJson(NAMES_KEY));

type OwnName = {
  title: string;
  /** The words of its sidebar row, with any space the page has after them
      (before a dot, say). */
  rowText: string;
};

/** Each tab's name as the page has it, by tab id. A chat has none here. */
const ownNames = new Map<string, OwnName>();

/** Makes the tab's title a button that renames it, and shows the name the
    tab was given in this browser, if it was. */
export function wireTitle(tab: HTMLElement): void {
  const heading = find(tab, CLASS_SELECTOR.title);
  if (!isChat(tab)) {
    ownNames.set(tab.id, { title: heading.textContent.trim(), rowText: rowTextNode(tab.id)?.data ?? "" });
  }
  const titleButton = make(
    "button",
    {
      type: "button",
      class: PAGE_CLASSES.titleButton,
      "data-tip": words.menuRename,
      "aria-description": words.menuRename,
    },
    make("span", { class: PAGE_CLASSES.titleText }, ...heading.childNodes),
  );
  heading.append(titleButton);
  titleButton.addEventListener("click", () => renameTab(tab));
  if (givenNames.has(tab.id)) showName(tab);
}

/** Turns the tab's title into a box to rename it in: Enter (or leaving it)
    keeps the name, Escape doesn't. */
export function renameTab(tab: HTMLElement): void {
  const heading = find(tab, CLASS_SELECTOR.title);
  const titleButton = find(heading, CLASS_SELECTOR.titleButton);
  const nameBox = makeNameBox(find(heading, CLASS_SELECTOR.titleText).textContent);
  titleButton.hidden = true;
  heading.append(nameBox);
  nameBox.focus();
  nameBox.select();

  // Once only: taking the box away can count as leaving it, which would
  // end the renaming a second time.
  let isOver = false;
  const endWith = (name: string | null) => {
    if (isOver) return;
    isOver = true;
    if (name !== null) saveName(tab, name);
    nameBox.remove();
    titleButton.hidden = false;
  };
  const keepName = () => endWith(nameBox.value.trim());
  const dropName = () => endWith(null);

  nameBox.addEventListener("keydown", (event) => {
    if (isComposing(event)) return;
    if (event.key === "Enter") keepName();
    else if (event.key === "Escape") dropName();
    else return;
    titleButton.focus();
    event.preventDefault();
    // The key is the box's alone: this Escape closes nothing else.
    event.stopPropagation();
  });
  // The focus is already wherever it went.
  nameBox.addEventListener("blur", keepName);
}

/** A box as wide as what's typed in it. */
function makeNameBox(nameNow: string): HTMLInputElement {
  const widthFor = (name: string) => Math.max(name.length, NARROWEST_NAME_BOX);
  const nameBox = make("input", {
    type: "text",
    class: PAGE_CLASSES.titleInput,
    value: nameNow,
    size: String(widthFor(nameNow)),
    maxlength: String(LONGEST_NAME),
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": words.menuRename,
  });
  nameBox.addEventListener("input", () => (nameBox.size = widthFor(nameBox.value)));
  return nameBox;
}

function saveName(tab: HTMLElement, typedName: string): void {
  if (isChat(tab)) return renameChat(tab, typedName);
  const givenName = givenNameFrom(typedName, ownNames.get(tab.id)?.title);
  if (givenName) givenNames.set(tab.id, givenName);
  else givenNames.delete(tab.id);
  storeName(tab.id, givenName);
  showName(tab);
}

/** Shows the name the tab's been given (or its own), in its title, on its
    row and in the window title. */
function showName(tab: HTMLElement): void {
  const ownName = ownNames.get(tab.id);
  if (!ownName) return;
  const givenName = givenNames.get(tab.id);
  const title = givenName ?? ownName.title;
  find(tab, CLASS_SELECTOR.titleText).textContent = title;
  const rowText = rowTextNode(tab.id);
  if (rowText) rowText.data = rowTextFor(givenName, ownName.rowText);
  if (tab === currentTab()) setTitle(title);
}

/** The words of a tab's sidebar row: its first text, before any dot. */
function rowTextNode(tabId: string): Text | null {
  const row = rowFor(tabId);
  const nameHolder = row?.querySelector(CLASS_SELECTOR.rowName) ?? row;
  if (!nameHolder) return null;
  const isWords = (node: ChildNode): node is Text => node instanceof Text && node.data.trim() !== "";
  return [...nameHolder.childNodes].find(isWords) ?? null;
}

/** Written over what's saved now, not over what this window read: another
    window may have renamed another tab since. */
function storeName(tabId: string, name: string | null): void {
  const savedNow = givenNamesIn(local.getJson(NAMES_KEY));
  if (name) savedNow.set(tabId, name);
  else savedNow.delete(tabId);
  local.setJson(NAMES_KEY, Object.fromEntries(savedNow));
}
