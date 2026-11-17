/* The open tab: the one the address names (tab-addresses.ts). It shows by
   PAGE_CLASSES.open, which a tab's page is built with and the script moves
   to each tab it opens. This keeps the rest in step with it: the sidebar's
   current row, the links to the other languages, the window title and
   where focus is. */
import { DATA } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { titleId } from "../contracts/page-ids.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { tabPagePath, tabWindowTitle } from "../contracts/tab-pages.ts";
import { unfold } from "./folding.ts";
import { clone, find, findAll } from "./lib/dom.ts";
import { showContextOf } from "./panel-context.ts";
import { askedTab, homeGreeting, homePath, homeTitle, sidebar, siteName } from "./page.ts";
import { addressOfPlace, openTabIn, ownAddress, placeOfLink, type Here, type IdKind } from "./tab-addresses.ts";

/** Whether a tab is a visitor's chat, not one of the portfolio's threads. */
export const isChat = (tab: HTMLElement): boolean => tab.hasAttribute(DATA.chat);

/** A chat and "Something else" have no page: they're in this one alone. */
function kindOf(id: string): IdKind {
  const element = id ? document.getElementById(id) : null;
  if (!element) return null;
  if (!element.matches(CLASS_SELECTOR.tab)) return "part";
  return isChat(element) || element === askedTab ? "tab" : "tab with a page";
}

/** This page, as its addresses are read. */
export const here: Here = { origin: location.origin, home: homePath, kindOf };

const tabWithId = (id: string | null | undefined): HTMLElement | null => (id ? document.getElementById(id) : null);

/** The tab the address names, if it names one. */
export const currentTab = (): HTMLElement | null => tabWithId(openTabIn(new URL(location.href), here));

/** The tab a link opens in place, if it opens one: "/about/" or "#about"
    opens the tab "about". */
export const tabLinkedTo = (href: string): HTMLElement | null =>
  tabWithId(placeOfLink(new URL(href, location.href), here)?.tab);

/** A tab's own address, by its id: its page's ("/about/"), or a chat's
    ("/#chat-l2x8f"). */
export const addressOf = (tabId: string): string => ownAddress(tabId, here);

/** A tab's address, to share. */
export const tabLink = (tab: HTMLElement): string => `${location.origin}${addressOf(tab.id)}`;

/** Where a link in text the script shows goes: one to a tab ("#about") or
    to the home screen ("#top") to its own address, and any other as it is. */
export function linkOnPage(href: string): string {
  const place = href.startsWith("#") ? placeOfLink(new URL(href, location.href), here) : undefined;
  return place ? addressOfPlace(place, here) : href;
}

/** A copy of `pattern` as a new tab, under its own id (and its title's,
    which names it to screen readers). */
export function copyTab(pattern: HTMLElement, id: string): HTMLElement {
  const tab = clone(pattern);
  tab.id = id;
  tab.setAttribute("aria-labelledby", titleId(id));
  find(tab, CLASS_SELECTOR.title).id = titleId(id);
  return tab;
}

const SIDEBAR_ROWS = `${PART_SELECTOR.navRow}, ${PART_SELECTOR.tabRow}`;

/** A tab's row in the sidebar: its first, as a thread can be among the rows
    at the top and in a group too. */
export const rowFor = (id: string): HTMLElement | null =>
  findAll(sidebar, SIDEBAR_ROWS).find((row) => tabLinkedTo(row.getAttribute("href") ?? "")?.id === id) ?? null;

/** Null for the home screen. */
function setWindowTitle(openTabName: string | null): void {
  document.title = openTabName ? tabWindowTitle(openTabName, siteName) : homeTitle;
}

/** Shows a tab's name in its title, and in the window title if it's the
    open tab. Its row in the sidebar is whoever names the tab's to change. */
export function showTabName(tab: HTMLElement, name: string): void {
  find(tab, CLASS_SELECTOR.titleText).textContent = name;
  if (tab === currentTab()) setWindowTitle(name);
}

function markCurrentRow(currentRow: Element | null): void {
  for (const row of findAll(sidebar, SIDEBAR_ROWS)) {
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

/** The open tab shows, and no other. */
function markOpen(openTab: HTMLElement | null): void {
  for (const tab of findAll(document, `${CLASS_SELECTOR.tab}${CLASS_SELECTOR.open}`)) {
    if (tab !== openTab) tab.classList.remove(PAGE_CLASSES.open);
  }
  openTab?.classList.add(PAGE_CLASSES.open);
}

/** The open tab's id, if it has a page of its own: null for the home
    screen, and for a tab that's in this page alone (a chat). */
const idWithAPage = (openTab: HTMLElement | null): string | null =>
  openTab && kindOf(openTab.id) === "tab with a page" ? openTab.id : null;

/** Each link to another language's page goes to the open tab there: to its
    page, under that language's home page (DATA.home), or to the home page
    for a tab that has none. */
function pointLanguageLinksAt(tabId: string | null): void {
  for (const link of findAll(document, `a${ATTRIBUTE_SELECTOR.home}`)) {
    const home = link.getAttribute(DATA.home) ?? "";
    link.setAttribute("href", tabId ? tabPagePath(home, tabId) : home);
  }
}

/** Brings the page into step with the open tab: it shows, its row is the
    sidebar's current one (in a folded group, the group unfolds), the links
    to the other languages go to it, the panel's Context lists its links,
    and the window is titled with its name. */
export function showOpenTab(): void {
  const tab = currentTab();
  markOpen(tab);
  const ownRow = tab ? rowFor(tab.id) : null;
  markCurrentRow(ownRow ?? rowStandingInFor(tab));
  const groupList = ownRow?.closest("ul");
  if (groupList?.hidden) unfold(groupList);
  const tabId = idWithAPage(tab);
  pointLanguageLinksAt(tabId);
  showContextOf(tabId);
  setWindowTitle(tab ? headingOf(tab).textContent : null);
}

/** Moves focus to the open tab's heading, or the home screen's. */
export function focusOpenTab(): void {
  const heading = headingOf(currentTab());
  // A heading takes focus only once it's told it can, and not by Tab.
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
