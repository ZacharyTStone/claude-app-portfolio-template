/* Menus, one open at a time (the question card is one too): arrow keys and
   a row's letter pick a row, Escape or a click elsewhere closes it, and a
   row with › opens a submenu beside it. */
import { DATA } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { SIZE, TIMING } from "./constants.ts";
import { closestFrom, findAll, make } from "./lib/dom.ts";
import { stepFocus } from "./lib/focus.ts";

/** A menu or a submenu, and a row in one: found by their roles. */
export const MENU = '[role="menu"]';
const MENU_ROW = '[role="menuitem"]';
/** A row that isn't greyed out. */
const ENABLED_MENU_ROW = `${MENU_ROW}:not([aria-disabled="true"])`;

/** One letter, "r" or "R": the key that picks the row with that letter
    (DATA.menuKey). */
const LETTER_KEY = /^[a-z]$/i;

/** The menu that's open, and the button it was opened from. */
type OpenMenu = { menu: HTMLElement; trigger: HTMLElement };
let openMenu: OpenMenu | null = null;

/** A button's attributes for the menu (or dialog) it opens, by its id. */
export const popupAttributes = (popupId: string, kind = "menu"): Record<string, string> => ({
  "aria-haspopup": kind,
  "aria-expanded": "false",
  "aria-controls": popupId,
});

/** Whether a menu is open. */
export const isMenuOpen = (): boolean => openMenu !== null;

/** Whether the open menu is the one this button opened. */
export const isOpenFrom = (trigger: HTMLElement): boolean => openMenu?.trigger === trigger;

/** A menu's own rows that can be chosen, not those of a submenu inside it. */
export const menuItems = (menu: HTMLElement): HTMLElement[] =>
  findAll(menu, ENABLED_MENU_ROW).filter((row) => row.closest(MENU) === menu);

/** Closes the open menu, and any submenu open in it. With `refocus`, focus
    goes back to the button that opened it. */
export function closeMenu({ refocus = false }: { refocus?: boolean } = {}): void {
  if (!openMenu) return;
  const { menu, trigger } = openMenu;
  openMenu = null;
  menu.hidden = true;
  for (const popup of menu.querySelectorAll(CLASS_SELECTOR.submenu)) {
    const submenu = submenus.get(popup);
    if (submenu) hideSubmenu(submenu);
  }
  trigger.setAttribute("aria-expanded", "false");
  if (refocus) trigger.focus();
}

/** What a menu does as it opens. */
type OpeningOptions = {
  /** Gets the menu ready before it shows: fills it, and puts it in place. */
  prepare?: () => void;
  /** What gets focus once it's open. Left out, the menu's first row does;
      returning nothing leaves focus where it is. */
  firstFocus?: () => HTMLElement | undefined;
};

/** Opens `menu` from `trigger`, or closes it if that's how it's open. */
export function toggleMenu(
  menu: HTMLElement,
  trigger: HTMLElement,
  { prepare, firstFocus }: OpeningOptions = {},
): void {
  if (openMenu?.menu === menu && openMenu.trigger === trigger) return closeMenu();
  closeMenu();
  prepare?.();
  menu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  openMenu = { menu, trigger };
  (firstFocus ? firstFocus() : menuItems(menu)[0])?.focus();
}

// ---- A menu's keys ---------------------------------------------------------------
// Each says whether the key was its to handle.

/** The arrow keys move focus between the rows, going round; Home and End
    go to the first and the last. */
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

function onMenuKey(menu: HTMLElement, event: KeyboardEvent): void {
  // A key pressed in a submenu is the submenu's own.
  if (closestFrom(event.target, MENU) !== menu) return;
  // Tab leaves the menu, so it closes, and focus goes where Tab takes it.
  if (event.key === "Tab") return closeMenu();
  const rows = menuItems(menu);
  const wasHandled = moveFocusByKey(event.key, rows) || pressLinkBySpace(event.key) || pressRowByLetter(event, rows);
  if (wasHandled) event.preventDefault();
}

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
      if (row && !opensSubmenu && !isGreyedOut) closeMenu({ refocus: true });
    },
    { capture: true },
  );
}

/** What a menu row is made with. */
type MenuRowOptions = {
  /** The letter that picks the row, shown at its right (MENU_KEYS). */
  key?: string;
  /** Where the row goes: with it the row is a link, without it a button. */
  href?: string;
  /** For a link to a page in another language: that language, and the
      language the row's own words are in. */
  hreflang?: string;
  lang?: string;
  /** The row's classes (its icon, say). */
  class?: string;
};

/** A menu row: a link with `href`, otherwise a button; `key` is its letter. */
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

// ---- Submenus ----------------------------------------------------------------------

/** A submenu, and what opens it. */
type Submenu = {
  /** The submenu itself: a menu inside the menu its row is in. */
  popup: HTMLElement;
  /** The row with › that opens it. */
  row: HTMLElement;
  /** The menu that row is in. */
  parentMenu: HTMLElement;
  /** Fills the submenu with its rows, each time it opens. */
  fill: (popup: HTMLElement) => void;
  /** The timer that hides it a moment after the mouse leaves it. */
  lingerTimer: number;
};

/** Each submenu, by its element: closing a menu hides the ones in it. */
const submenus = new WeakMap<Element, Submenu>();

/** How far right a menu can reach, from the window's left edge: SIZE.edge
    short of the window's right edge, or of the inside of a box around it
    that clips (the sidebar scrolls, so it cuts off what sticks out of it). */
function rightLimitFor(menu: HTMLElement): number {
  let limit = innerWidth;
  for (let box = menu.parentElement; box; box = box.parentElement) {
    const clips = getComputedStyle(box).overflowX !== "visible";
    if (clips) limit = Math.min(limit, box.getBoundingClientRect().left + box.clientLeft + box.clientWidth);
  }
  return limit - SIZE.edge;
}

/** Puts a submenu beside its row, its first row level with it; or, when
    there's no room beside it, below its row, and then never past the edge. */
function placeSubmenu({ popup, row, parentMenu }: Submenu): void {
  popup.classList.remove(PAGE_CLASSES.below);
  popup.style.left = "";
  popup.style.top = `${row.offsetTop - SIZE.menuPadding}px`;
  const rightLimit = rightLimitFor(parentMenu);
  if (popup.getBoundingClientRect().right <= rightLimit) return;
  popup.classList.add(PAGE_CLASSES.below);
  popup.style.top = `${row.offsetTop + row.offsetHeight}px`;
  const overhang = popup.getBoundingClientRect().right - rightLimit;
  if (overhang > 0) popup.style.left = `${popup.offsetLeft - overhang}px`;
}

function hideSubmenu({ popup, row }: Submenu): void {
  popup.hidden = true;
  row.setAttribute("aria-expanded", "false");
}

/** Shows a submenu, filled afresh if it wasn't showing already; with
    `moveFocus`, focus goes to its first row. */
function showSubmenu(submenu: Submenu, { moveFocus }: { moveFocus: boolean }): void {
  const { popup, row } = submenu;
  clearTimeout(submenu.lingerTimer);
  if (popup.hidden) {
    submenu.fill(popup);
    for (const item of menuItems(popup)) item.tabIndex = -1;
    popup.hidden = false;
    row.setAttribute("aria-expanded", "true");
    placeSubmenu(submenu);
  }
  if (moveFocus) menuItems(popup)[0]?.focus();
}

/** The mouse opens a submenu by hovering over its row, and leaves it open
    for TIMING.submenuLinger after it leaves the row or the submenu: long
    enough to cross from one to the other. Touch has no hover: it clicks. */
function openOnHover(submenu: Submenu): void {
  const { popup, row } = submenu;
  row.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") showSubmenu(submenu, { moveFocus: false });
  });
  for (const part of [row, popup]) {
    part.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse") return;
      submenu.lingerTimer = setTimeout(() => hideSubmenu(submenu), TIMING.submenuLinger);
    });
  }
  popup.addEventListener("pointerenter", () => clearTimeout(submenu.lingerTimer));
}

/** Makes `row` a row with › that opens a submenu beside it (or below it,
    where there's no room), on hover, a click, or the right arrow key.
    `fill` fills it each time it opens. */
export function withSubmenu(row: HTMLElement, menu: HTMLElement, fill: (popup: HTMLElement) => void): void {
  const popup = make("div", { class: `pop ${PAGE_CLASSES.submenu}`, role: "menu", hidden: "" });
  row.setAttribute("aria-haspopup", "menu");
  row.setAttribute("aria-expanded", "false");
  row.append(make("span", { class: "chevron", "aria-hidden": "true" }));
  const submenu: Submenu = { popup, row, parentMenu: menu, fill, lingerTimer: 0 };
  submenus.set(popup, submenu);

  // A click opens it (hovering has usually opened it already, so a toggle
  // would close it again); from the keyboard it also moves into it. A click
  // that a key made counts no presses of a mouse button.
  row.addEventListener("click", (event) => {
    const cameFromKeyboard = event.detail === 0;
    showSubmenu(submenu, { moveFocus: cameFromKeyboard });
  });
  openOnHover(submenu);
  row.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight") return;
    event.preventDefault();
    showSubmenu(submenu, { moveFocus: true });
  });
  asMenu(popup);
  // The left arrow or Escape goes back to its row. The key stops here, so
  // Escape closes the submenu alone, not the menu it's in (main.ts).
  popup.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    hideSubmenu(submenu);
    row.focus();
  });
  menu.append(popup);
}

/** A click outside the open menu (and its button) closes it, as it comes
    in: before what was clicked can open another menu, which it then
    leaves open. Escape is main.ts's, as it closes the open menu or else the
    phone drawer. */
export function initMenus(): void {
  addEventListener(
    "click",
    (event) => {
      if (!openMenu) return;
      const clickPath = event.composedPath();
      const isOutside = !clickPath.includes(openMenu.menu) && !clickPath.includes(openMenu.trigger);
      if (isOutside) closeMenu();
    },
    { capture: true },
  );
}
