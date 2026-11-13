/* A menu: arrow keys and a row's letter pick a row, and choosing one closes
   it. It opens as a popup (popup.ts), and a row can open a submenu
   (submenu.ts). */
import { DATA } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { closestFrom, findAll, make } from "./lib/dom.ts";
import { stepFocus } from "./lib/focus.ts";
import { closePopup, closePopupAndReturnFocus, togglePopup } from "./popup.ts";

/** A menu or a submenu, and a row in one: found by their roles. */
export const MENU = '[role="menu"]';
const MENU_ROW = '[role="menuitem"]';
const ENABLED_MENU_ROW = `${MENU_ROW}:not([aria-disabled="true"])`;
const ROW_WITH_OPEN_SUBMENU = `${MENU_ROW}[aria-expanded="true"]`;

/** "r" or "R": the key that picks the row with that letter (DATA.menuKey). */
const LETTER_KEY = /^[a-z]$/i;

/** A press of a menu's button: opens the menu from it, with the focus on
    its first row, or closes it if that's how it's open. `prepare` fills
    the menu and puts it in place before it shows. */
export function toggleMenu(menu: HTMLElement, trigger: HTMLElement, prepare?: () => void): void {
  togglePopup(menu, trigger, {
    prepare() {
      closeSubmenusIn(menu);
      prepare?.();
    },
    firstFocus: () => menuItems(menu)[0],
  });
}

/** A submenu left open when its menu closed isn't open when the menu
    opens again. */
function closeSubmenusIn(menu: HTMLElement): void {
  for (const submenu of findAll(menu, MENU)) submenu.hidden = true;
  for (const row of findAll(menu, ROW_WITH_OPEN_SUBMENU)) row.setAttribute("aria-expanded", "false");
}

/** A menu's own rows that can be chosen, not those of a submenu inside it. */
export const menuItems = (menu: HTMLElement): HTMLElement[] =>
  findAll(menu, ENABLED_MENU_ROW).filter((row) => row.closest(MENU) === menu);

/** Gives a menu its keys, and closes it when one of its rows is chosen. */
export function asMenu(menu: HTMLElement): void {
  menu.addEventListener("keydown", (event) => onMenuKey(menu, event));
  // Closed (focus back on its button) before the row does what it does,
  // which may move focus, or open another menu: so this listens as the
  // click comes in (capture), ahead of the row's own listener.
  menu.addEventListener(
    "click",
    (event) => {
      const row = closestFrom(event.target, MENU_ROW);
      const opensSubmenu = row?.hasAttribute("aria-haspopup");
      const isGreyedOut = row?.getAttribute("aria-disabled") === "true";
      if (row && !opensSubmenu && !isGreyedOut) closePopupAndReturnFocus();
    },
    { capture: true },
  );
}

function onMenuKey(menu: HTMLElement, event: KeyboardEvent): void {
  const isInSubmenu = closestFrom(event.target, MENU) !== menu;
  if (isInSubmenu) return;
  // Tab leaves the menu, so it closes, and focus goes where Tab takes it.
  if (event.key === "Tab") return closePopup();
  const rows = menuItems(menu);
  const wasHandled = moveFocusByKey(event.key, rows) || pressLinkBySpace(event.key) || pressRowByLetter(event, rows);
  if (wasHandled) event.preventDefault();
}

/** The arrow keys move focus between the rows, going round; Home and End
    go to the first and the last. Says whether the key was one of them. */
function moveFocusByKey(key: string, rows: HTMLElement[]): boolean {
  if (key === "ArrowDown") stepFocus(rows, 1);
  else if (key === "ArrowUp") stepFocus(rows, -1);
  else if (key === "Home") rows[0]?.focus();
  else if (key === "End") rows.at(-1)?.focus();
  else return false;
  return true;
}

/** Space presses the row that has focus when it's a link, as it does a
    button (a link, left to the browser, takes only Enter). */
function pressLinkBySpace(key: string): boolean {
  const focused = document.activeElement;
  if (key !== " " || !(focused instanceof HTMLAnchorElement)) return false;
  focused.click();
  return true;
}

/** A letter presses the row it's the key of, if a row has it. With Alt,
    Ctrl or Cmd held it's a shortcut of the browser's. */
function pressRowByLetter(event: KeyboardEvent, rows: HTMLElement[]): boolean {
  if (!LETTER_KEY.test(event.key) || event.altKey || event.ctrlKey || event.metaKey) return false;
  const rowWithKey = rows.find((row) => row.getAttribute(DATA.menuKey) === event.key.toLowerCase());
  rowWithKey?.click();
  return rowWithKey !== undefined;
}

type MenuRowOptions = {
  /** The letter that picks the row, shown at its right (MENU_KEYS). */
  key?: string;
  /** With it the row is a link, without it a button. */
  href?: string;
  /** For a link to a page in another language: that language, and the
      language the row's own words are in. */
  hreflang?: string;
  lang?: string;
  class?: string;
};

export function menuRow(label: string, { key, ...attributes }: MenuRowOptions = {}): HTMLElement {
  const isLink = Boolean(attributes.href);
  return make(
    isLink ? "a" : "button",
    {
      type: isLink ? null : "button",
      role: "menuitem",
      tabindex: "-1",
      [DATA.menuKey]: key,
      ...attributes,
    },
    make("span", { class: PAGE_CLASSES.rowWords }, label),
    ...(key ? [make("span", { class: "key", "aria-hidden": "true" }, key.toUpperCase())] : []),
  );
}
