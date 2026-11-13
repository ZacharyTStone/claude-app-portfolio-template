/* The account row's menu, with a few surprises: the time where you are
   beside the visitor's, a language row that keeps the open tab, and a
   "Log out" that really does. */
import { DATA, LOCAL_ZONE } from "../contracts/page-attributes.ts";
import { HOURS, partOfDay } from "../contracts/day-parts.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { PAGE_IDS, panelId } from "../contracts/page-ids.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { SEPARATOR } from "./constants.ts";
import { asButton, byId, clone, find, findAll, make, query } from "./lib/dom.ts";
import { goHome } from "./chats.ts";
import { asMenu, menuItems, menuRow, popupAttributes, toggleMenu, withSubmenu } from "./menus.ts";
import { detailsPanel, root, side } from "./page.ts";

// ---- The clock ---------------------------------------------------------------------

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
/** Every time zone is a whole number of quarter hours from UTC. */
const QUARTER_HOUR_MINUTES = 15;

/** The time of day somewhere. */
type TimeInZone = {
  /** The hour there, 0 to 23. */
  hour: number;
  /** How far ahead of UTC it is there, in minutes (negative for behind). */
  minutesAheadOfUtc: number;
};

/** The hour in a time zone, and how far ahead of UTC the zone is now. */
function timeIn(timeZone: string, now: Date): TimeInZone {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(now);
  const numberOf = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  // Midnight is hour 0, even from a browser that writes it as 24.
  const hour = numberOf("hour") % 24;
  // The zone's date and time, read as if they were UTC's: how far that is
  // from the real time is how far the zone is from UTC. To the nearest
  // quarter hour, as the zone's time was read to the minute, without its
  // seconds.
  const zoneTimeAsUtc = Date.UTC(numberOf("year"), numberOf("month") - 1, numberOf("day"), hour, numberOf("minute"));
  const minutesAhead = (zoneTimeAsUtc - now.getTime()) / MS_PER_MINUTE;
  return { hour, minutesAheadOfUtc: Math.round(minutesAhead / QUARTER_HOUR_MINUTES) * QUARTER_HOUR_MINUTES };
}

/** Writes the time now into each of the clock's times: yours, in your
    time zone, and the visitor's own (LOCAL_ZONE), in the page's language. */
function showTimes(clock: HTMLElement, now: Date): void {
  for (const time of findAll(clock, ATTRIBUTE_SELECTOR.zone)) {
    const zone = time.getAttribute(DATA.zone);
    // With no time zone named, the browser uses the visitor's own.
    const timeZone = zone === LOCAL_ZONE ? undefined : (zone ?? undefined);
    time.textContent = new Intl.DateTimeFormat(root.lang, { timeZone, hour: "numeric", minute: "2-digit" }).format(now);
  }
}

/** How far apart you and the visitor are, in the words the clock carries:
    "Same time", or "{n}h ahead" or "{n}h behind" with the hours put in.
    Nothing when the clock doesn't carry the words. */
function hoursApartNote(clock: HTMLElement, hoursYouAreAhead: number): string | null | undefined {
  if (hoursYouAreAhead === 0) return clock.getAttribute(DATA.clockSame);
  const wording = clock.getAttribute(hoursYouAreAhead > 0 ? DATA.clockAhead : DATA.clockBehind);
  return wording?.replace("{n}", String(Math.abs(hoursYouAreAhead)));
}

/** The time where you are beside the visitor's, how far apart you are, and
    a guess at what you're up to at that hour. */
function tellTime(clock: HTMLElement): void {
  const now = new Date();
  const yourTimeZone = query(clock, PART_SELECTOR.ownerZone)?.getAttribute(DATA.zone) ?? "UTC";
  const yourTime = timeIn(yourTimeZone, now);
  const visitorMinutesBehindUtc = now.getTimezoneOffset();
  const hoursYouAreAhead = (yourTime.minutesAheadOfUtc + visitorMinutesBehindUtc) / MINUTES_PER_HOUR;
  const apartNote = hoursApartNote(clock, hoursYouAreAhead);
  const moodNote = clock.getAttribute(DATA.mood(partOfDay(yourTime.hour, HOURS.mood)));
  showTimes(clock, now);
  find(clock, CLASS_SELECTOR.clockNote).textContent = `${apartNote}${SEPARATOR}${moodNote}`;
}

// ---- The language row --------------------------------------------------------------

/** The sidebar's links to the other languages' pages. */
const OTHER_LANGUAGE_LINKS = `${CLASS_SELECTOR.languageSwitch} a`;

/** A row for each other language the site is in, opening the same tab
    there: `hash` is the open tab's part of the address ("#about"). */
const languageRows = (hash: string): HTMLElement[] =>
  findAll(side, OTHER_LANGUAGE_LINKS).map((languageLink) => {
    const language = languageLink.getAttribute("hreflang") ?? "";
    // The language's name in itself, if the link carries it.
    const name = languageLink.getAttribute(DATA.languageName) ?? languageLink.textContent;
    return menuRow(name, {
      href: `${languageLink.getAttribute("href")}${hash}`,
      hreflang: language,
      lang: language,
    });
  });

/** Puts a row that opens a submenu of the other languages in the place of
    the menu's link to one of them. */
function replaceWithLanguageSubmenu(languageLink: Element, accountMenu: HTMLElement): void {
  const row = menuRow(languageLink.firstChild?.textContent ?? "", { class: "ic i-globe" });
  languageLink.replaceWith(row);
  withSubmenu(row, accountMenu, (popup) => popup.replaceChildren(...languageRows(location.hash)));
}

// ---- "Log out" ---------------------------------------------------------------------

/** A contact link as the goodbye shows it: a copy that's no longer a
    menu's row, without the note at its right ("Link"). An email link says
    the address itself, not just "Email". */
function goodbyeLink(link: HTMLElement): HTMLElement {
  const copy = clone(link);
  copy.removeAttribute("role");
  copy.removeAttribute("tabindex");
  copy.querySelector(CLASS_SELECTOR.rowMeta)?.remove();
  if (link instanceof HTMLAnchorElement && link.protocol === "mailto:") {
    copy.className = "ic i-contact";
    copy.textContent = link.pathname;
  }
  return copy;
}

/** The details panel's contact links: the rows of the config's
    panel.context. */
const PANEL_CONTACT_LINKS = `section[aria-labelledby="${panelId("context")}"] ${CLASS_SELECTOR.panelRows} a`;

/** Your contact links, for the goodbye: the panel's own, or else your email. */
function contactLinks(accountMenu: HTMLElement): HTMLElement[] {
  const panelLinks = findAll(detailsPanel, PANEL_CONTACT_LINKS);
  const links = panelLinks.length ? panelLinks : findAll(accountMenu, CLASS_SELECTOR.mailRow);
  return links.map(goodbyeLink);
}

/** The goodbye: a dialog over the whole page, in the words the "Log out"
    row carries, with your contact links and the button back. */
function makeGoodbye(logoutRow: HTMLElement, accountMenu: HTMLElement, logBackInButton: HTMLElement): HTMLElement {
  const wording = (attribute: string) => logoutRow.getAttribute(attribute) ?? "";
  return make(
    "div",
    { class: PAGE_CLASSES.bye, role: "dialog", "aria-modal": "true", "aria-labelledby": PAGE_IDS.byeTitle },
    make("h2", { class: "hello", id: PAGE_IDS.byeTitle }, wording(DATA.byeTitle)),
    make("p", { class: PAGE_CLASSES.intro }, wording(DATA.byeText)),
    make("p", { class: PAGE_CLASSES.byeLinks }, ...contactLinks(accountMenu)),
    logBackInButton,
  );
}

/** "Log out" really does: the page fades to a goodbye with your contact
    links, and "Log back in" (or Escape) brings it back, at the start. */
function logOut(logoutRow: HTMLElement, accountMenu: HTMLElement): void {
  const logBackInButton = make(
    "button",
    { type: "button", class: PAGE_CLASSES.byeBack },
    logoutRow.getAttribute(DATA.byeBack) ?? "",
  );
  const goodbye = makeGoodbye(logoutRow, accountMenu, logBackInButton);
  // Everything behind the goodbye, the skip link before the shell included,
  // can't be reached while it shows.
  const everythingBehind = [...document.body.children].filter((element) => element instanceof HTMLElement);
  const setBehindInert = (isInert: boolean) => {
    for (const element of everythingBehind) element.inert = isInert;
  };

  const logBackIn = () => {
    goodbye.remove();
    setBehindInert(false);
    document.removeEventListener("keydown", logBackInOnEscape, true);
    goHome();
  };
  // Heard first (on the document, as the key comes in) and stopped there:
  // this Escape logs back in, and closes nothing else (main.ts).
  const logBackInOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    logBackIn();
  };
  logBackInButton.addEventListener("click", logBackIn);
  document.addEventListener("keydown", logBackInOnEscape, true);
  setBehindInert(true);
  document.body.append(goodbye);
  logBackInButton.focus();
}

// ---- The menu ----------------------------------------------------------------------

/** Makes the account row open its menu, and gives the menu its clock, its
    language row and its "Log out". */
export function initAccount(): void {
  const accountRow = find(side, CLASS_SELECTOR.accountRow);
  const accountMenu = byId(PAGE_IDS.accountMenu);
  asMenu(accountMenu);
  for (const row of menuItems(accountMenu)) row.tabIndex = -1;
  asButton(accountRow, popupAttributes(PAGE_IDS.accountMenu));

  // The language row goes to the other language's page, keeping the open
  // tab: its address is brought up to date each time the menu opens. With
  // more than one other language it opens a submenu of them instead.
  const languageLink = accountMenu.querySelector(ATTRIBUTE_SELECTOR.langLink);
  const otherLanguagePage = languageLink?.getAttribute("href");
  const hasSeveralOtherLanguages = findAll(side, OTHER_LANGUAGE_LINKS).length > 1;
  if (languageLink && hasSeveralOtherLanguages) replaceWithLanguageSubmenu(languageLink, accountMenu);
  const linkThatFollowsTheTab = hasSeveralOtherLanguages ? null : languageLink;

  const clock = query(accountMenu, ATTRIBUTE_SELECTOR.clock);
  accountRow.addEventListener("click", () =>
    toggleMenu(accountMenu, accountRow, {
      prepare() {
        if (clock) tellTime(clock);
        linkThatFollowsTheTab?.setAttribute("href", `${otherLanguagePage}${location.hash}`);
      },
    }),
  );

  const logoutRow = find(accountMenu, ATTRIBUTE_SELECTOR.logout);
  logoutRow.addEventListener("click", () => logOut(logoutRow, accountMenu));
}
