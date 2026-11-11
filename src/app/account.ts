/* The account row's menu, with a few surprises: the time where you are
   beside the visitor's, a language row that keeps the open tab, and a
   "Log out" that really does. */
import { DATA, HOURS, LOCAL_ZONE, PAGE_CLASSES, PAGE_IDS, partOfDay, SEPARATOR } from "../shared/page-data.ts";
import { CLASS, SELECTOR } from "./constants.ts";
import { asButton, byId, clone, find, findAll, make, query } from "./lib/dom.ts";
import { goHome } from "./chats.ts";
import { asMenu, menuItems, menuRow, popupAttributes, toggleMenu, withSubmenu } from "./menus.ts";
import { panel, root, side } from "./page.ts";

// A row for each other language the site is in, opening the same tab there.
const languageRows = (hash: string): HTMLElement[] =>
  findAll(side, SELECTOR.language).map((other) => {
    const lang = other.getAttribute("hreflang") ?? "";
    return menuRow(other.getAttribute(DATA.name) ?? other.textContent, {
      href: `${other.getAttribute("href")}${hash}`,
      hreflang: lang,
      lang,
    });
  });

// The hour in a time zone, and how far ahead of UTC it is (in minutes, to
// the nearest quarter hour).
function clockIn(timeZone: string, now: Date): { hour: number; offset: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const hour = part("hour") % 24;
  const there = Date.UTC(part("year"), part("month") - 1, part("day"), hour, part("minute"));
  return { hour, offset: Math.round((there - now.getTime()) / 60_000 / 15) * 15 };
}

// The time where you are beside the visitor's, how far apart you are, and a
// guess at what you're up to.
function tellTime(clock: HTMLElement): void {
  const now = new Date();
  const said = (name: string) => clock.getAttribute(name);
  const zone = query(clock, SELECTOR.ownerZone)?.getAttribute(DATA.zone) ?? "UTC";
  const { hour, offset } = clockIn(zone, now);
  const gap = (offset + now.getTimezoneOffset()) / 60;
  const away =
    gap === 0 ? said(DATA.same) : said(gap > 0 ? DATA.ahead : DATA.behind)?.replace("{n}", String(Math.abs(gap)));
  const mood = said(DATA.mood(partOfDay(hour, HOURS.mood)));
  for (const time of findAll(clock, SELECTOR.zone)) {
    const at = time.getAttribute(DATA.zone);
    const timeZone = at === LOCAL_ZONE ? undefined : (at ?? undefined);
    time.textContent = new Intl.DateTimeFormat(root.lang, { timeZone, hour: "numeric", minute: "2-digit" }).format(now);
  }
  find(clock, SELECTOR.clockNote).textContent = `${away}${SEPARATOR}${mood}`;
}

// Your contact links, for the goodbye: the panel's own, or else your email.
function contactLinks(account: HTMLElement): HTMLElement[] {
  const contacts = findAll(panel, SELECTOR.contactLinks);
  return (contacts.length ? contacts : findAll(account, SELECTOR.mailRow)).map((link) => {
    const copy = clone(link);
    copy.removeAttribute("role");
    copy.removeAttribute("tabindex");
    copy.querySelector(SELECTOR.rowMeta)?.remove();
    // The address itself, not just "Email".
    if (link instanceof HTMLAnchorElement && link.protocol === "mailto:") {
      copy.className = "ic i-contact";
      copy.textContent = link.pathname;
    }
    return copy;
  });
}

// "Log out" really does: the page fades to a goodbye with your contact
// links, and "Log back in" brings it back.
function logOut(logout: HTMLElement, account: HTMLElement): void {
  const said = (name: string) => logout.getAttribute(name) ?? "";
  const back = make("button", { type: "button", class: CLASS.byeBack }, said(DATA.byeBack));
  const bye = make(
    "div",
    { class: CLASS.bye, role: "dialog", "aria-modal": "true", "aria-labelledby": PAGE_IDS.byeTitle },
    make("h2", { class: "hello", id: PAGE_IDS.byeTitle }, said(DATA.byeTitle)),
    make("p", { class: PAGE_CLASSES.intro }, said(DATA.byeText)),
    make("p", { class: CLASS.byeLinks }, ...contactLinks(account)),
    back,
  );
  // Everything behind it, the skip link before the shell included.
  const behind = [...document.body.children].filter((el) => el instanceof HTMLElement);
  const leave = () => {
    bye.remove();
    for (const el of behind) el.inert = false;
    document.removeEventListener("keydown", onKey, true);
    goHome();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    leave();
  };
  back.addEventListener("click", leave);
  document.addEventListener("keydown", onKey, true);
  for (const el of behind) el.inert = true;
  document.body.append(bye);
  back.focus();
}

export function initAccount(): void {
  const me = find(side, SELECTOR.me);
  const account = byId(PAGE_IDS.accountMenu);
  asMenu(account);
  for (const item of menuItems(account)) item.tabIndex = -1;
  asButton(me, popupAttributes(PAGE_IDS.accountMenu));

  // Its language row goes to the other language, keeping the open tab; with
  // more than one other language it opens a submenu of them instead.
  let languageLink = account.querySelector(SELECTOR.languageLink);
  const languageHome = languageLink?.getAttribute("href");
  if (languageLink && findAll(side, SELECTOR.language).length > 1) {
    const row = menuRow(languageLink.firstChild?.textContent ?? "", { class: "ic i-globe" });
    languageLink.replaceWith(row);
    languageLink = null;
    withSubmenu(row, account, (sub) => sub.replaceChildren(...languageRows(location.hash)));
  }
  const clock = query(account, SELECTOR.clock);
  me.addEventListener("click", () =>
    toggleMenu(account, me, {
      build() {
        if (clock) tellTime(clock);
        languageLink?.setAttribute("href", `${languageHome}${location.hash}`);
      },
    }),
  );

  const logout = find(account, SELECTOR.logout);
  logout.addEventListener("click", () => logOut(logout, account));
}
