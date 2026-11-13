/* Renaming a tab: its title (or Rename in its menus) becomes a box to type
   a new name in, shown on its sidebar row too and remembered per browser
   and language. A chat keeps its own name (chats.ts). */
import { isRecord, isString } from "../contracts/guards.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { SELECTOR, SIZE, STORAGE } from "./constants.ts";
import { find, isComposing, make } from "./lib/dom.ts";
import { local } from "./lib/storage.ts";
import { renameChat } from "./chats.ts";
import { root, words } from "./page.ts";
import { currentTab, isChat, rowFor, setTitle } from "./tabs.ts";

// ---- The names this browser has given ----------------------------------------------

/** Where the names given in this language are kept. */
const NAMES_KEY = `${STORAGE.names}${root.lang}`;

/** The names as they're saved now, by tab id. Checked, not trusted:
    anything saved that isn't a name is left out. */
function readSavedNames(): Map<string, string> {
  const names = new Map<string, string>();
  const saved = local.getJson(NAMES_KEY);
  if (isRecord(saved)) {
    for (const [tabId, name] of Object.entries(saved)) if (isString(name)) names.set(tabId, name);
  }
  return names;
}

/** The names given to tabs in this browser, by tab id. */
const givenNames = readSavedNames();

/** Saves one tab's name (or, given null, forgets it), written over what's
    saved now: another window may have renamed another tab since this one
    read them. */
function storeName(tabId: string, name: string | null): void {
  const savedNow = readSavedNames();
  if (name) savedNow.set(tabId, name);
  else savedNow.delete(tabId);
  local.setJson(NAMES_KEY, Object.fromEntries(savedNow));
}

// ---- A tab's name, where it shows --------------------------------------------------

/** A tab's own name, as the page has it. */
type OwnName = {
  /** Its title. */
  title: string;
  /** The words of its sidebar row, with any space the page has after them
      (before a dot, say). */
  rowText: string;
};

/** Each tab's own name, before any rename, by tab id. A chat has none here. */
const ownNames = new Map<string, OwnName>();

/** The words of a tab's sidebar row: its first text, before any dot. */
function rowTextNode(tabId: string): Text | null {
  const row = rowFor(tabId);
  const nameHolder = row?.querySelector(SELECTOR.rowName) ?? row;
  if (!nameHolder) return null;
  const isWords = (node: ChildNode): node is Text => node instanceof Text && node.data.trim() !== "";
  return [...nameHolder.childNodes].find(isWords) ?? null;
}

/** Shows the name the tab's been given (or its own), in its title, on its
    row and in the window title. */
function showName(tab: HTMLElement): void {
  const ownName = ownNames.get(tab.id);
  if (!ownName) return;
  const givenName = givenNames.get(tab.id);
  const title = givenName ?? ownName.title;
  find(tab, SELECTOR.titleText).textContent = title;
  const rowText = rowTextNode(tab.id);
  if (rowText) {
    // A given name keeps the space the row's own words end with.
    const spaceAfter = ownName.rowText.endsWith(" ") ? " " : "";
    rowText.data = givenName ? `${givenName}${spaceAfter}` : ownName.rowText;
  }
  if (tab === currentTab()) setTitle(title);
}

/** Gives a tab a new name, or with none (or its own title) goes back to
    its own. */
function saveName(tab: HTMLElement, typedName: string): void {
  if (isChat(tab)) return renameChat(tab, typedName);
  const isOwnTitle = typedName === ownNames.get(tab.id)?.title;
  const givenName = typedName && !isOwnTitle ? typedName : null;
  if (givenName) givenNames.set(tab.id, givenName);
  else givenNames.delete(tab.id);
  storeName(tab.id, givenName);
  showName(tab);
}

// ---- The box a tab is renamed in ---------------------------------------------------

/** The box a name is typed in, holding the name as it is now. It's as wide
    as what's typed in it, and no narrower than SIZE.nameBox characters. */
function makeNameBox(nameNow: string): HTMLInputElement {
  const widthFor = (name: string) => Math.max(name.length, SIZE.nameBox);
  const nameBox = make("input", {
    type: "text",
    class: PAGE_CLASSES.titleInput,
    value: nameNow,
    size: String(widthFor(nameNow)),
    maxlength: String(SIZE.nameMax),
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": words.menuRename,
  });
  nameBox.addEventListener("input", () => (nameBox.size = widthFor(nameBox.value)));
  return nameBox;
}

/** Turns the tab's title into a box to rename it in: Enter (or leaving it)
    keeps the name, Escape doesn't. */
export function renameTab(tab: HTMLElement): void {
  const heading = find(tab, SELECTOR.title);
  const titleButton = find(heading, SELECTOR.titleButton);
  const nameBox = makeNameBox(find(heading, SELECTOR.titleText).textContent);
  titleButton.hidden = true;
  heading.append(nameBox);
  nameBox.focus();
  nameBox.select();

  // Once only: taking the box away can count as leaving it, which would
  // finish a second time.
  let isFinished = false;
  const finish = ({ keepName, refocus }: { keepName: boolean; refocus: boolean }) => {
    if (isFinished) return;
    isFinished = true;
    if (keepName) saveName(tab, nameBox.value.trim());
    nameBox.remove();
    titleButton.hidden = false;
    if (refocus) titleButton.focus();
  };
  nameBox.addEventListener("keydown", (event) => {
    if (isComposing(event)) return;
    if (event.key === "Enter") finish({ keepName: true, refocus: true });
    else if (event.key === "Escape") finish({ keepName: false, refocus: true });
    else return;
    event.preventDefault();
    // The key is the box's alone: this Escape closes nothing else (main.ts).
    event.stopPropagation();
  });
  // Leaving the box keeps the name; focus is already wherever it went.
  nameBox.addEventListener("blur", () => finish({ keepName: true, refocus: false }));
}

/** The tab's title: a button that renames it, showing the name it was
    given in this browser, if it was. */
export function wireTitle(tab: HTMLElement): void {
  const heading = find(tab, SELECTOR.title);
  // A chat keeps its name itself.
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
