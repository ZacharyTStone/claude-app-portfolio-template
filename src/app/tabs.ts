/* The open tab: the one the address names (#about), shown by :target as it
   is without JavaScript. This keeps the rest in step with it: the sidebar's
   current row, the window title and where focus is. */
import { DATA } from "../contracts/page-attributes.ts";
import { CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { SEPARATOR } from "./constants.ts";
import { titleId } from "../contracts/page-ids.ts";
import { clone, find } from "./lib/dom.ts";
import { unfold } from "./folding.ts";
import { homeGreeting, pageTitle, sidebar, siteName } from "./page.ts";

/** The tab the address names, if it names one. */
export function currentTab(): HTMLElement | null {
  const named = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
  return named?.matches(CLASS_SELECTOR.tab) ? named : null;
}

/** Whether a tab is a chat (chats.ts), not one of the portfolio's threads. */
export const isChat = (tab: HTMLElement): boolean => tab.hasAttribute(DATA.chat);

/** A tab's address, to share. */
export const tabLink = (tab: HTMLElement): string => `${location.origin}${location.pathname}#${tab.id}`;

/** A copy of `pattern` as a new tab, under its own id (and its title's,
    which names it to screen readers). */
export function copyTab(pattern: HTMLElement, id: string): HTMLElement {
  const tab = clone(pattern);
  tab.id = id;
  tab.setAttribute("aria-labelledby", titleId(id));
  find(tab, CLASS_SELECTOR.title).id = titleId(id);
  return tab;
}

/** A tab's row in the sidebar. */
export const rowFor = (id: string): Element | null => sidebar.querySelector(`a[href="#${CSS.escape(id)}"]`);

/** Names the open tab in the window title; null for the home screen. */
export function setTitle(name: string | null): void {
  document.title = name ? `${name}${SEPARATOR}${siteName}` : pageTitle;
}

/** Takes the #… off the address, without leaving a bare # behind; with
    `replace`, in place of the page you were on in the history. */
export function clearHash(replace = false): void {
  if (replace) location.replace("#");
  else location.hash = "";
  history.replaceState(null, "", location.pathname + location.search);
}

/** Marks one of the sidebar's rows as the current page, and no other. */
function markCurrentRow(currentRow: Element | null): void {
  for (const row of sidebar.querySelectorAll(`${PART_SELECTOR.navRow}, ${PART_SELECTOR.tabRow}`)) {
    if (row === currentRow) row.setAttribute("aria-current", "page");
    else row.removeAttribute("aria-current");
  }
}

/** Brings the page into step with the open tab, and with `moveFocus`
    moves focus to its heading. */
export function sync(moveFocus: boolean): void {
  const tab = currentTab();
  const ownRow = tab ? rowFor(tab.id) : null;
  // The home screen and a new chat with nothing sent in it yet have no row
  // of their own, so "New tab" is selected for them.
  const standsInNewTab = !tab || isChat(tab);
  markCurrentRow(ownRow ?? (standsInNewTab ? sidebar.querySelector(CLASS_SELECTOR.newTab) : null));

  // Opening a tab inside a folded group unfolds it.
  const groupList = ownRow?.closest("ul");
  if (groupList?.hidden) unfold(groupList);

  const heading = tab ? find(tab, CLASS_SELECTOR.title) : homeGreeting;
  setTitle(tab ? heading.textContent : null);
  if (moveFocus) {
    // A heading takes focus only once it's told it can, and not by Tab.
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

/** What openTab was asked to run once its tab is open, until it is. */
let pendingOpen: { tab: HTMLElement; onceOpen: () => void } | null = null;

/** Opens a tab, then runs `onceOpen` once it's open (and everything that
    happens when a tab opens has happened). With `replace`, in place of the
    page you were on in the history, so Back doesn't return to it. */
export function openTab(tab: HTMLElement, onceOpen?: () => void, replace = false): void {
  if (tab === currentTab()) return onceOpen?.();
  pendingOpen = onceOpen ? { tab, onceOpen } : null;
  if (replace) location.replace(`#${tab.id}`);
  else location.hash = tab.id;
}

/** Runs what openTab was asked to do, if its tab is the one that has just
    opened: main.ts calls it once the page is in step with the address.
    Another tab opening first means it won't be. */
export function finishOpening(): void {
  const openedTab = currentTab();
  if (!pendingOpen || !openedTab) return; // not yet: an address that names no tab
  const { tab: awaitedTab, onceOpen } = pendingOpen;
  pendingOpen = null;
  if (openedTab === awaitedTab) onceOpen();
}
