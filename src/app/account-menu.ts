/* The account row's menu, with a few surprises: the time where you are
   beside the visitor's (clock.ts), a language row that keeps the open tab,
   and a "Log out" that really does (goodbye.ts). */
import { mapValues } from "es-toolkit";
import { DATA, LOCAL_ZONE } from "../contracts/page-attributes.ts";
import { HOURS } from "../contracts/day-parts.ts";
import { PAGE_IDS } from "../contracts/page-ids.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { asButton, byId, find, findAll, query } from "./lib/dom.ts";
import { clockNote, timeIn, type ClockWording } from "./clock.ts";
import { logOut } from "./goodbye.ts";
import { asMenu, menuItems, menuRow, toggleMenu } from "./menu.ts";
import { root, side } from "./page.ts";
import { popupAttributes } from "./popup.ts";
import { withSubmenu } from "./submenu.ts";

/** The sidebar's links to the other languages' pages. */
const OTHER_LANGUAGE_LINKS = `${CLASS_SELECTOR.languageSwitch} a`;

export function initAccountMenu(): void {
  const accountRow = find(side, CLASS_SELECTOR.accountRow);
  const accountMenu = byId(PAGE_IDS.accountMenu);
  asMenu(accountMenu);
  for (const row of menuItems(accountMenu)) row.tabIndex = -1;
  asButton(accountRow, popupAttributes(PAGE_IDS.accountMenu));

  // The language row goes to the other language's page, at the tab that's
  // open: its address is brought up to date each time the menu opens. With
  // several other languages it's a submenu of them instead.
  const languageLink = accountMenu.querySelector(ATTRIBUTE_SELECTOR.langLink);
  const otherLanguagePage = languageLink?.getAttribute("href");
  const hasSeveralOtherLanguages = findAll(side, OTHER_LANGUAGE_LINKS).length > 1;
  if (languageLink && hasSeveralOtherLanguages) replaceWithLanguageSubmenu(languageLink, accountMenu);
  const linkThatFollowsTheTab = hasSeveralOtherLanguages ? null : languageLink;

  const clock = query(accountMenu, ATTRIBUTE_SELECTOR.clock);
  accountRow.addEventListener("click", () =>
    toggleMenu(accountMenu, accountRow, () => {
      if (clock) tellTime(clock);
      linkThatFollowsTheTab?.setAttribute("href", `${otherLanguagePage}${location.hash}`);
    }),
  );

  const logoutRow = find(accountMenu, ATTRIBUTE_SELECTOR.logout);
  logoutRow.addEventListener("click", () => logOut(logoutRow, accountMenu));
}

/** The time where you are beside the visitor's, and under them how far
    apart you are and a guess at what you're up to at that hour. */
function tellTime(clock: HTMLElement): void {
  const now = new Date();
  const ownerZone = query(clock, PART_SELECTOR.ownerZone)?.getAttribute(DATA.zone) ?? "UTC";
  const visitorMinutesAheadOfUtc = -now.getTimezoneOffset();
  showTimes(clock, now);
  const note = clockNote(wordingOf(clock), timeIn(ownerZone, now), visitorMinutesAheadOfUtc);
  find(clock, CLASS_SELECTOR.clockNote).textContent = note;
}

/** Each of the clock's times, in the page's language: yours in your time
    zone, and the visitor's own (LOCAL_ZONE). */
function showTimes(clock: HTMLElement, now: Date): void {
  for (const time of findAll(clock, ATTRIBUTE_SELECTOR.zone)) {
    const zone = time.getAttribute(DATA.zone);
    // With no time zone named, the browser uses the visitor's own.
    const timeZone = zone === LOCAL_ZONE ? undefined : (zone ?? undefined);
    time.textContent = new Intl.DateTimeFormat(root.lang, { timeZone, hour: "numeric", minute: "2-digit" }).format(now);
  }
}

function wordingOf(clock: HTMLElement): ClockWording {
  const wording = (attribute: string) => clock.getAttribute(attribute) ?? "";
  return {
    same: wording(DATA.clockSame),
    ahead: wording(DATA.clockAhead),
    behind: wording(DATA.clockBehind),
    moods: mapValues(HOURS.mood, (_startHour, mood) => wording(DATA.mood(mood))),
  };
}

/** Puts a row that opens a submenu of the other languages in the place of
    the menu's link to one of them. */
function replaceWithLanguageSubmenu(languageLink: Element, accountMenu: HTMLElement): void {
  const row = menuRow(languageLink.firstChild?.textContent ?? "", { class: "icon i-globe" });
  languageLink.replaceWith(row);
  withSubmenu(row, accountMenu, (popup) => popup.replaceChildren(...languageRows(location.hash)));
}

/** A row for each other language, opening the same tab there: `hash` is
    the open tab's part of the address ("#about"). */
function languageRows(hash: string): HTMLElement[] {
  return findAll(side, OTHER_LANGUAGE_LINKS).map((languageLink) => {
    const language = languageLink.getAttribute("hreflang") ?? "";
    // The language's name in itself, if the link carries it.
    const name = languageLink.getAttribute(DATA.languageName) ?? languageLink.textContent;
    return menuRow(name, {
      href: `${languageLink.getAttribute("href")}${hash}`,
      hreflang: language,
      lang: language,
    });
  });
}
