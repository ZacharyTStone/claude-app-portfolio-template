/* A visitor's chats: tabs of their own. One is listed under "Chats" once
   something is sent in it, and saved (in this browser, per language) until
   it's deleted or the page is refreshed. */
import { DATA } from "../../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { CHATS_GROUP, groupId, ID_PREFIX } from "../../contracts/page-ids.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { foldable } from "../folding.ts";
import { clone, find, make } from "../lib/dom.ts";
import { local } from "../lib/storage.ts";
import { main, root, sidebar, siteName, tagline, words } from "../page.ts";
import { copyTab, currentTab, focusOpenTab, showOpenTab, showTabName } from "../tabs.ts";
import { say } from "../toast.ts";
import type { Exchange } from "./exchange.ts";
import { messagesOf, questionOf } from "./messages.ts";
import { readExchange, readSavedChats, toSaved, withChat, withoutChat, type SavedChat } from "./saved-chats.ts";

/** localStorage: the chats of each language, under this and the language. */
const SAVED_CHATS_PREFIX = "portfolio:chats:";
const SAVED_CHATS_KEY = `${SAVED_CHATS_PREFIX}${root.lang}`;

/** A chat keeps what was sent in it as it's saved (`sources`), so what a
    later version saved with an entry is still there to write back. */
type Chat = SavedChat & {
  tab: HTMLElement;
  /** Its row in the sidebar, once something is sent in it. */
  row: HTMLElement | null;
};

/** What chats are made with: main.ts has these, from modules that use this
    one. */
export type ChatSetup = {
  /** "Something else" as the page was built: a chat's tab is a copy of it. */
  tabPattern: HTMLElement;
  /** Makes a chat's tab work like every other. */
  wireTab: (tab: HTMLElement) => void;
  addRowMenu: (row: HTMLElement) => void;
  /** Where a visitor is taken when the chat they're in is deleted. */
  goHome: () => void;
};

type Setup = Omit<ChatSetup, "tabPattern"> & { blankTab: HTMLElement };

let setup: Setup | null = null;
const chats = new Map<string, Chat>();
/** The new chat that nothing has been sent in yet. */
let emptyChat: Chat | null = null;

const chatOf = (tab: HTMLElement): Chat | undefined => chats.get(tab.getAttribute(DATA.chat) ?? "");

/** Until something is sent in a chat, it says who this is. */
function whoThisIs(): HTMLElement {
  const name = make("p", { class: PAGE_CLASSES.chatName }, siteName);
  const line = tagline ? [make("p", { class: PAGE_CLASSES.intro }, tagline)] : [];
  return make("div", { class: PAGE_CLASSES.chatHello }, name, ...line);
}

/** A new chat's tab: the pattern, emptied. It has no link to share: a chat
    is kept in this browser only. */
function blankChatTab(tabPattern: HTMLElement): HTMLElement {
  const blankTab = clone(tabPattern);
  find(blankTab, CLASS_SELECTOR.title).textContent = words.newChat;
  find(blankTab, CLASS_SELECTOR.thread).replaceChildren(whoThisIs());
  blankTab.querySelectorAll(ATTRIBUTE_SELECTOR.copyLink).forEach((button) => button.remove());
  return blankTab;
}

export function initChats({ tabPattern, ...rest }: ChatSetup): void {
  setup = { ...rest, blankTab: blankChatTab(tabPattern) };
}

function theSetup(): Setup {
  if (!setup) throw new Error("initChats() comes before the first chat");
  return setup;
}

const readChats = (): SavedChat[] => readSavedChats(local.getJson(SAVED_CHATS_KEY), Date.now());

const asSaved = ({ id, title, sources, created }: Chat): SavedChat => ({ id, title, sources, created });

/** Written over what's saved now, not over what this window read: another
    window may have saved chats of its own since. */
function saveChat(chat: Chat): void {
  local.setJson(SAVED_CHATS_KEY, withChat(readChats(), asSaved(chat)));
}

function forgetChat(chat: Chat): void {
  local.setJson(SAVED_CHATS_KEY, withoutChat(readChats(), chat.id));
}

/** Forgets the chats saved in this browser, in every language. */
export const forgetChats = (): void => local.clear(SAVED_CHATS_PREFIX);

function makeChat(saved: SavedChat): Chat {
  const { blankTab, wireTab } = theSetup();
  const tab = copyTab(blankTab, `${ID_PREFIX.chat}${saved.id}`);
  tab.setAttribute(DATA.chat, saved.id);
  main.append(tab);
  wireTab(tab);
  const chat: Chat = { ...saved, tab, row: null };
  chats.set(chat.id, chat);
  return chat;
}

/** A chat's id is the time it was made, in base 36. */
const makeNewChat = (now = Date.now()): Chat =>
  makeChat({ id: now.toString(36), title: null, sources: [], created: now });

/** The tab of the chat that nothing has been sent in yet: there's one at a
    time, made when it's first asked for. */
export function emptyChatTab(): HTMLElement {
  emptyChat ??= makeNewChat();
  return emptyChat.tab;
}

/** A new chat that nothing was sent in goes when you leave it. */
export function dropEmptyChat(): void {
  if (!emptyChat || currentTab() === emptyChat.tab) return;
  chats.delete(emptyChat.id);
  emptyChat.tab.remove();
  emptyChat = null;
}

/** A chat is named after its first question, unless it's been renamed. */
function showChatName(chat: Chat): void {
  const [first] = chat.sources;
  const name = chat.title || (first && questionOf(readExchange(first))) || words.newChat;
  showTabName(chat.tab, name);
  if (chat.row) find(chat.row, CLASS_SELECTOR.rowName).textContent = name;
}

/** "Chats" in the sidebar, above the account row: its heading, made the
    first time there's a chat to list, and the list after it. */
function chatsList(): HTMLElement {
  const headingId = groupId(CHATS_GROUP);
  const list = document.getElementById(headingId)?.nextElementSibling;
  if (list instanceof HTMLElement) return list;
  const heading = make("p", { class: PAGE_CLASSES.groupHeading, id: headingId }, words.chats);
  const newList = make("ul", { class: PAGE_CLASSES.groupRows, "aria-labelledby": headingId });
  find(sidebar, CLASS_SELECTOR.account).before(heading, newList);
  foldable(heading);
  return newList;
}

function whenMade(chat: Chat): string {
  const dayAndTime = new Intl.DateTimeFormat(root.lang, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return dayAndTime.format(chat.created);
}

/** Lists a chat under "Chats", newest at the top. */
function listChat(chat: Chat): void {
  chat.row = make(
    "a",
    { href: `#${chat.tab.id}` },
    make("span", { class: PAGE_CLASSES.rowName }),
    make("span", { class: PAGE_CLASSES.rowHint }, whenMade(chat)),
  );
  chatsList().prepend(make("li", {}, chat.row));
  theSetup().addRowMenu(chat.row);
  showChatName(chat);
}

/** Takes a chat's row out of the sidebar, and "Chats" with the last one. */
function unlistChat(chat: Chat): void {
  const list = chat.row?.closest("ul");
  chat.row?.closest("li")?.remove();
  if (!list || list.children.length) return;
  list.previousElementSibling?.remove();
  list.remove();
}

/** Everything sent in a chat, shown at once. Nothing, for a tab that isn't
    a chat or a chat that's been deleted. */
export function showChat(tab: HTMLElement): void {
  const chat = chatOf(tab);
  if (!chat) return;
  const messages = chat.sources.flatMap((saved) => messagesOf(readExchange(saved)));
  find(tab, CLASS_SELECTOR.thread).replaceChildren(...messages);
}

/** The chats saved in this browser, back in the sidebar, newest at the top. */
export function restoreChats(): void {
  for (const saved of readChats().sort((one, other) => one.created - other.created)) {
    const chat = makeChat(saved);
    listChat(chat);
    showChat(chat.tab);
  }
}

/** Once a chat has changed, its name and what's saved of it follow. */
function chatChanged(chat: Chat): void {
  showChatName(chat);
  saveChat(chat);
}

/** Something's been sent in a chat: it's kept, and the chat listed. Says
    where in the chat it's kept, for updateInChat; null if the chat is gone. */
export function addToChat(tab: HTMLElement, exchange: Exchange): number | null {
  const chat = chatOf(tab);
  if (!chat) return null;
  chat.sources.push(toSaved(exchange));
  if (!chat.row) listChat(chat);
  if (emptyChat === chat) emptyChat = null;
  chatChanged(chat);
  return chat.sources.length - 1;
}

/** What was sent in a chat is kept as it is now: /ask has answered it. */
export function updateInChat(tab: HTMLElement, place: number, exchange: Exchange): void {
  const chat = chatOf(tab);
  if (!chat) return;
  chat.sources[place] = toSaved(exchange);
  chatChanged(chat);
}

/** With no name given, a chat goes back to being named after its first
    question. */
export function renameChat(tab: HTMLElement, name: string): void {
  const chat = chatOf(tab);
  if (!chat) return;
  chat.title = name || null;
  chatChanged(chat);
}

export function deleteChat(tab: HTMLElement): void {
  const chat = chatOf(tab);
  if (!chat) return;
  chats.delete(chat.id);
  if (emptyChat === chat) emptyChat = null;
  unlistChat(chat);
  forgetChat(chat);
  // Focus was in what's gone: the tab, or its row's "…".
  if (tab === currentTab()) theSetup().goHome();
  else {
    showOpenTab();
    focusOpenTab();
  }
  tab.remove();
  say(words.chatDeleted);
}
