/* Renaming a tab: its title (or Rename in its menus) becomes a box to type
   a new name in, shown on its sidebar row too and remembered per browser
   and language. A chat keeps its own name (chats.ts). */
import { isRecord, isString } from "../shared/guards.ts";
import { CLASS, SELECTOR, SIZE, STORAGE } from "./constants.ts";
import { find, isComposing, make } from "./lib/dom.ts";
import { local } from "./lib/storage.ts";
import { renameChat } from "./chats.ts";
import { root, words } from "./page.ts";
import { currentTab, isChat, rowFor, setTitle } from "./tabs.ts";

const SAVED = `${STORAGE.names}${root.lang}`;

function readNames(): Map<string, string> {
  const names = new Map<string, string>();
  const saved = local.getJson(SAVED);
  if (isRecord(saved)) {
    for (const [id, name] of Object.entries(saved)) if (isString(name)) names.set(id, name);
  }
  return names;
}

// The names given to tabs in this browser, by tab id.
const names = readNames();

// One tab's name, written over what's saved now: another window may have
// renamed another tab since this one read them.
function storeName(id: string, name: string | null): void {
  const saved = readNames();
  if (name) saved.set(id, name);
  else saved.delete(id);
  local.setJson(SAVED, Object.fromEntries(saved));
}

// Each tab's own title, and its sidebar row's words, before any rename.
const originals = new Map<string, { title: string; row: string }>();

// The words of a tab's sidebar row: its first text, before any dot.
function rowWords(id: string): Text | null {
  const row = rowFor(id);
  const holder = row?.querySelector(SELECTOR.rowName) ?? row;
  if (!holder) return null;
  return [...holder.childNodes].find((node): node is Text => node instanceof Text && node.data.trim() !== "") ?? null;
}

// Shows the name the tab's been given (or its own), in its title, on its
// row and in the window title.
function nameTab(tab: HTMLElement): void {
  const original = originals.get(tab.id);
  if (!original) return;
  const name = names.get(tab.id);
  find(tab, SELECTOR.titleText).textContent = name ?? original.title;
  const label = rowWords(tab.id);
  if (label) label.data = name ? `${name}${original.row.endsWith(" ") ? " " : ""}` : original.row;
  if (tab === currentTab()) setTitle(name ?? original.title);
}

// A new name, or none to go back to the tab's own.
function saveName(tab: HTMLElement, value: string): void {
  if (isChat(tab)) return renameChat(tab, value);
  const name = value && value !== originals.get(tab.id)?.title ? value : null;
  if (name) names.set(tab.id, name);
  else names.delete(tab.id);
  storeName(tab.id, name);
  nameTab(tab);
}

/** Turns the tab's title into a box to rename it in: Enter (or leaving it)
    keeps the name, Escape doesn't. */
export function renameTab(tab: HTMLElement): void {
  const heading = find(tab, SELECTOR.title);
  const button = find(heading, SELECTOR.titleButton);
  const current = find(heading, SELECTOR.titleText).textContent;
  const input = make("input", {
    type: "text",
    class: CLASS.titleInput,
    value: current,
    size: String(Math.max(current.length, SIZE.nameBox)),
    maxlength: String(SIZE.nameMax),
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": words.menuRename,
  });
  input.addEventListener("input", () => (input.size = Math.max(input.value.length, SIZE.nameBox)));
  button.hidden = true;
  heading.append(input);
  input.focus();
  input.select();

  let done = false;
  const finish = (save: boolean, refocus: boolean) => {
    if (done) return;
    done = true;
    if (save) saveName(tab, input.value.trim());
    input.remove();
    button.hidden = false;
    if (refocus) button.focus();
  };
  input.addEventListener("keydown", (event) => {
    if (isComposing(event)) return;
    if (event.key === "Enter") finish(true, true);
    else if (event.key === "Escape") finish(false, true);
    else return;
    event.preventDefault();
    event.stopPropagation();
  });
  input.addEventListener("blur", () => finish(true, false));
}

/** The tab's title: a button that renames it, showing the name it was
    given in this browser, if it was. */
export function wireTitle(tab: HTMLElement): void {
  const heading = find(tab, SELECTOR.title);
  // A chat keeps its name itself.
  if (!isChat(tab)) originals.set(tab.id, { title: heading.textContent.trim(), row: rowWords(tab.id)?.data ?? "" });
  const name = make(
    "button",
    {
      type: "button",
      class: CLASS.titleButton,
      "data-tip": words.menuRename,
      "aria-description": words.menuRename,
    },
    make("span", { class: CLASS.titleText }, ...heading.childNodes),
  );
  heading.append(name);
  name.addEventListener("click", () => renameTab(tab));
  if (names.has(tab.id)) nameTab(tab);
}
