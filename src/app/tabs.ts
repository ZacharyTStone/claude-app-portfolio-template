/* The open tab: the one the address names (#about), shown by :target as it
   is without JavaScript. This keeps the rest in step with it: the sidebar's
   current row, the window title and where focus is. */
import { DATA, SEPARATOR, titleId } from "../shared/page-data.ts";
import { SELECTOR } from "./constants.ts";
import { clone, find } from "./lib/dom.ts";
import { unfold } from "./folding.ts";
import { hello, pageTitle, side, siteName } from "./page.ts";

/** The tab the address names, if it names one. */
export function currentTab(): HTMLElement | null {
  const el = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
  return el?.matches(SELECTOR.tab) ? el : null;
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
  find(tab, SELECTOR.title).id = titleId(id);
  return tab;
}

/** A tab's row in the sidebar. */
export const rowFor = (id: string): Element | null => side.querySelector(`a[href="#${CSS.escape(id)}"]`);

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

/** Brings the page into step with the open tab, and with `moveFocus`
    moves focus to its heading. */
export function sync(moveFocus: boolean): void {
  const tab = currentTab();
  // The tab's row. The home screen and a new chat with nothing sent in it
  // yet have none, so "New tab" is selected for them.
  const row = tab && rowFor(tab.id);
  const current = row ?? (!tab || isChat(tab) ? side.querySelector(SELECTOR.newTab) : null);
  for (const link of side.querySelectorAll(`${SELECTOR.navRow}, ${SELECTOR.tabRow}`)) {
    if (link === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  // Opening a tab inside a folded group unfolds it.
  const list = row?.closest("ul");
  if (list?.hidden) unfold(list);

  const heading = tab ? find(tab, SELECTOR.title) : hello;
  setTitle(tab ? heading.textContent : null);
  if (moveFocus) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

// What openTab was asked to do once its tab is open.
let waiting: { tab: HTMLElement; then: () => void } | null = null;

/** Opens a tab, then runs `then` once it's open (and everything that
    happens when a tab opens has happened). With `replace`, in place of the
    page you were on in the history, so Back doesn't return to it. */
export function openTab(tab: HTMLElement, then?: () => void, replace = false): void {
  if (tab === currentTab()) return then?.();
  waiting = then ? { tab, then } : null;
  if (replace) location.replace(`#${tab.id}`);
  else location.hash = tab.id;
}

/** Runs what openTab was asked to do, if its tab is the one that has just
    opened: main.ts calls it once the page is in step with the address.
    Another tab opening first means it won't be. */
export function finishOpening(): void {
  const tab = currentTab();
  if (!waiting || !tab) return; // not yet: an address that names no tab
  const { tab: awaited, then } = waiting;
  waiting = null;
  if (tab === awaited) then();
}
