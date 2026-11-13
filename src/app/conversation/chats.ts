/* Chats: "New tab" opens one, an empty thread with the question card open.
   Once something is sent in it, it's listed under "Chats" and saved (in
   this browser, per language) until it's deleted or the page is refreshed. */
import { CHATS_GROUP, groupId, ID_PREFIX } from "../../contracts/page-ids.ts";
import { DATA } from "../../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { STORAGE } from "../constants.ts";
import { readSavedChats, type SavedChat } from "./saved-chats.ts";
import { clone, find, make } from "../lib/dom.ts";
import { local } from "../lib/storage.ts";
import { foldable } from "../folding.ts";
import { isPopupOpenFrom } from "../popup.ts";
import { askedTab, main, root, sidebar, siteName, tagline, words } from "../page.ts";
import { bubble, messagesFor, questionFor, type Source } from "./replies.ts";
import { closeDrawerAndReturnFocus, isWide } from "../sidebar.ts";
import { clearHash, copyTab, currentTab, openTab, setTitle, sync } from "../tabs.ts";
import { say } from "../toast.ts";

const SAVED = `${STORAGE.chats}${root.lang}`;

type Chat = SavedChat & { tab: HTMLElement; row: HTMLElement | null };

/** What makes a chat's tab, and its row in the sidebar, work like every
    other: main.ts has it, from modules that use this one. */
export type ChatWiring = {
  wireTab: (tab: HTMLElement) => void;
  addRowMenu: (row: HTMLElement) => void;
};

// A new chat's tab: "Something else" as the page has it, emptied. Until
// something is sent in it, it says who this is (the name and the tagline),
// and it has no link to share: it's kept in this browser only.
const shell = clone(askedTab);
find(shell, CLASS_SELECTOR.title).textContent = words.newChat;
find(shell, CLASS_SELECTOR.thread).replaceChildren(
  make(
    "div",
    { class: PAGE_CLASSES.chatHello },
    make("p", { class: PAGE_CLASSES.chatName }, siteName),
    ...(tagline ? [make("p", { class: PAGE_CLASSES.intro }, tagline)] : []),
  ),
);
shell.querySelectorAll(ATTRIBUTE_SELECTOR.copyLink).forEach((button) => button.remove());

const chats = new Map<string, Chat>();
// The new chat that nothing has been sent in yet.
let emptyChat: Chat | null = null;
let wiring: ChatWiring | null = null;

const chatOf = (tab: HTMLElement) => chats.get(tab.getAttribute(DATA.chat) ?? "");

export function initChats(wired: ChatWiring): void {
  wiring = wired;
}

function wire(): ChatWiring {
  if (!wiring) throw new Error("initChats() comes before the first chat");
  return wiring;
}

// One chat, written over what's saved now (or taken out of it, once it's
// deleted): another window may have saved chats of its own since.
function storeChat(chat: Chat, keep: boolean): void {
  const others = readChats().filter((saved) => saved.id !== chat.id);
  const { id, title, sources, created } = chat;
  local.setJson(SAVED, keep && sources.length ? [...others, { id, title, sources, created }] : others);
}

function makeChat({
  id = Date.now().toString(36),
  title = null,
  sources = [],
  created = Date.now(),
}: Partial<SavedChat> = {}): Chat {
  const tab = copyTab(shell, `${ID_PREFIX.chat}${id}`);
  tab.setAttribute(DATA.chat, id);
  main.append(tab);
  wire().wireTab(tab);
  const chat: Chat = { id, title, sources, created, row: null, tab };
  chats.set(id, chat);
  return chat;
}

// Named after its first question, unless it's been renamed.
function showChatName(chat: Chat): void {
  const first = chat.sources[0];
  const name = chat.title || (first && questionFor(first)) || words.newChat;
  find(chat.tab, CLASS_SELECTOR.titleText).textContent = name;
  if (chat.row) find(chat.row, CLASS_SELECTOR.rowName).textContent = name;
  if (chat.tab === currentTab()) setTitle(name);
}

// "Chats" in the sidebar, above the account row: its heading, made the
// first time there's a chat to list, and the list after it.
function chatsList(): HTMLElement {
  const id = groupId(CHATS_GROUP);
  const list = document.getElementById(id)?.nextElementSibling;
  if (list instanceof HTMLElement) return list;
  const heading = make("p", { class: PAGE_CLASSES.groupHeading, id }, words.chats);
  const made = make("ul", { class: PAGE_CLASSES.groupRows, "aria-labelledby": id });
  find(sidebar, CLASS_SELECTOR.account).before(heading, made);
  foldable(heading);
  return made;
}

// Lists a chat under "Chats", newest at the top.
function listChat(chat: Chat): void {
  const when = new Intl.DateTimeFormat(root.lang, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  chat.row = make(
    "a",
    { href: `#${chat.tab.id}` },
    make("span", { class: PAGE_CLASSES.rowName }),
    make("span", { class: PAGE_CLASSES.rowHint }, when.format(chat.created)),
  );
  chatsList().prepend(make("li", {}, chat.row));
  wire().addRowMenu(chat.row);
  showChatName(chat);
}

/** Everything sent in a chat, shown at once. */
export function showChat(tab: HTMLElement): void {
  const chat = chatOf(tab);
  if (!chat) return; // deleted
  const thread = find(tab, CLASS_SELECTOR.thread);
  thread.replaceChildren();
  for (const source of chat.sources) {
    const messages = messagesFor(source);
    if (messages) thread.append(bubble(messages.question), ...messages.answer);
  }
}

// Changes a chat, if it's still there; its name, and what's saved, follow.
function changeChat(tab: HTMLElement, change: (chat: Chat) => void): void {
  const chat = chatOf(tab);
  if (!chat) return;
  change(chat);
  showChatName(chat);
  storeChat(chat, true);
}

/** Something's been sent in a chat: it's kept, and listed. */
export function chatSent(tab: HTMLElement, source: Source): void {
  changeChat(tab, (chat) => {
    chat.sources.push(source);
    if (!chat.row) listChat(chat);
    if (emptyChat === chat) emptyChat = null;
  });
}

/** What was sent in a chat has changed (/ask has answered). */
export const chatChanged = (tab: HTMLElement): void => changeChat(tab, () => {});

export function renameChat(tab: HTMLElement, value: string): void {
  changeChat(tab, (chat) => (chat.title = value || null));
}

export function deleteChat(tab: HTMLElement): void {
  const chat = chatOf(tab);
  if (!chat) return;
  chats.delete(chat.id);
  if (emptyChat === chat) emptyChat = null;
  const list = chat.row?.closest("ul");
  chat.row?.closest("li")?.remove();
  if (list && !list.children.length) {
    list.previousElementSibling?.remove();
    list.remove();
  }
  storeChat(chat, false);
  // Focus was in what's gone (the tab, or its row's "…").
  if (tab === currentTab()) goHome();
  else sync(true);
  tab.remove();
  say(words.chatDeleted);
}

/** Opens a new chat, with the question card open and ready, or, given
    `then`, runs that with the chat's tab instead (the home screen sends
    what was asked there). With `replace`, in place of the page you were on
    in the history. */
export function newChat(replace = false, then?: (tab: HTMLElement) => void): void {
  closeDrawerAndReturnFocus();
  const { tab } = (emptyChat ??= makeChat());
  const composer = find(tab, CLASS_SELECTOR.composer);
  openTab(
    tab,
    () => {
      if (then) then(tab);
      else if (!isPopupOpenFrom(composer)) composer.click();
    },
    replace,
  );
}

/** Back to the start: the home screen, or on a phone a new chat with the
    question card open, which is where a visit there starts. */
export function goHome(): void {
  if (!isWide()) return newChat();
  closeDrawerAndReturnFocus();
  if (location.hash) clearHash();
  sync(true);
}

/** A new chat that nothing was sent in goes when you leave it. */
export function dropEmptyChat(): void {
  if (!emptyChat || currentTab() === emptyChat.tab) return;
  chats.delete(emptyChat.id);
  emptyChat.tab.remove();
  emptyChat = null;
}

const readChats = (): SavedChat[] => readSavedChats(local.getJson(SAVED), Date.now());

/** Forgets the chats saved in this browser, in every language. */
export const forgetChats = (): void => local.clear(STORAGE.chats);

/** The chats saved in this browser, back in the sidebar, newest at the top. */
export function restoreChats(): void {
  for (const saved of readChats().sort((a, b) => a.created - b.created)) {
    const chat = makeChat(saved);
    listChat(chat);
    showChat(chat.tab);
  }
}
