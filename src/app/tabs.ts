/* The open tab: the one the address names (#about), shown by :target as it
   is without JavaScript. This keeps the rest in step with it: the sidebar's
   current row, the window title and where focus is. */
import { DATA } from "../contracts/page-attributes.ts";
import { titleId } from "../contracts/page-ids.ts";
import { CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { SEPARATOR } from "./constants.ts";
import { unfold } from "./folding.ts";
import { clone, find } from "./lib/dom.ts";
import { homeGreeting, pageTitle, sidebar, siteName } from "./page.ts";

/** The tab the address names, if it names one. */
export function currentTab(): HTMLElement | null {
  const named = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
  return named?.matches(CLASS_SELECTOR.tab) ? named : null;
}

/** Whether a tab is a visitor's chat, not one of the portfolio's threads. */
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

/** Null for the home screen. */
function setWindowTitle(openTabName: string | null): void {
  document.title = openTabName ? `${openTabName}${SEPARATOR}${siteName}` : pageTitle;
}

/** Shows a tab's name in its title, and in the window title if it's the
    open tab. Its row in the sidebar is whoever names the tab's to change. */
export function showTabName(tab: HTMLElement, name: string): void {
  find(tab, CLASS_SELECTOR.titleText).textContent = name;
  if (tab === currentTab()) setWindowTitle(name);
}

function leaveNoBareHash(): void {
  history.replaceState(null, "", location.pathname + location.search);
}

/** Takes the #… off the address: no tab is open, and Back returns to the
    one that was. */
export function clearHash(): void {
  location.hash = "";
  leaveNoBareHash();
}

/** Takes the #… off the address in place of the page you were on in the
    history: Back doesn't return to it. */
export function clearHashReplacingHistory(): void {
  location.replace("#");
  leaveNoBareHash();
}

function markCurrentRow(currentRow: Element | null): void {
  for (const row of sidebar.querySelectorAll(`${PART_SELECTOR.navRow}, ${PART_SELECTOR.tabRow}`)) {
    if (row === currentRow) row.setAttribute("aria-current", "page");
    else row.removeAttribute("aria-current");
  }
}

/** The home screen and a chat with nothing sent in it yet have no row of
    their own: "New tab" stands in for them. */
function rowStandingInFor(tab: HTMLElement | null): Element | null {
  const hasNoRowYet = !tab || isChat(tab);
  return hasNoRowYet ? sidebar.querySelector(CLASS_SELECTOR.newTab) : null;
}

const headingOf = (tab: HTMLElement | null): HTMLElement => (tab ? find(tab, CLASS_SELECTOR.title) : homeGreeting);

/** Brings the page into step with the open tab: its row is the sidebar's
    current one (in a folded group, the group unfolds), and the window is
    titled with its name. */
export function showOpenTab(): void {
  const tab = currentTab();
  const ownRow = tab ? rowFor(tab.id) : null;
  markCurrentRow(ownRow ?? rowStandingInFor(tab));
  const groupList = ownRow?.closest("ul");
  if (groupList?.hidden) unfold(groupList);
  setWindowTitle(tab ? headingOf(tab).textContent : null);
}

/** Moves focus to the open tab's heading, or the home screen's. */
export function focusOpenTab(): void {
  const heading = headingOf(currentTab());
  // A heading takes focus only once it's told it can, and not by Tab.
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
