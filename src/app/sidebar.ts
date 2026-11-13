/* The sidebar: on a phone, a drawer; on wider screens it can be hidden and
   resized. Arrow keys move between its rows. */
import { clamp } from "es-toolkit";
import { PAGE_IDS } from "../contracts/page-ids.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { SELECTOR, SIZE, STORAGE } from "./constants.ts";
import { byId, find, findAll, make } from "./lib/dom.ts";
import { followPointer } from "./lib/drag.ts";
import { isFocusOn, stepFocus } from "./lib/focus.ts";
import { local } from "./lib/storage.ts";
import { MENU } from "./menus.ts";
import { shell, side, words } from "./page.ts";
import { clearHash, currentTab } from "./tabs.ts";

const widerThanPhone = matchMedia(`(min-width: ${SIZE.wide}px)`);
/** The button before the name, which hides the sidebar on wider screens. */
const hideButton = find(side, ATTRIBUTE_SELECTOR.sideToggle);

/** Wider than a phone, where the sidebar is beside the tab, not a drawer. */
export const isWide = (): boolean => widerThanPhone.matches;

// ---- The phone drawer ------------------------------------------------------------
// Without JavaScript the menu button targets the sidebar, which hides the
// open tab behind it; a class keeps the tab where it is. It can also be
// open because the address is #tabs (from before this file ran, or the
// back button); closing it then clears the address.

/** Whether the address names the sidebar (#tabs): that alone opens the
    drawer, as it does without JavaScript. */
export const isAddressOnDrawer = (): boolean => side.matches(":target");

/** Whether the phone drawer is open: by its class, or by the address. */
export const isDrawerOpen = (): boolean => side.classList.contains(PAGE_CLASSES.drawerOpen) || isAddressOnDrawer();

/** Opens the drawer, with focus on the open tab's row, or else its first row. */
function openDrawer(): void {
  side.classList.add(PAGE_CLASSES.drawerOpen);
  const row = side.querySelector('[aria-current="page"]') ?? side.querySelector(SELECTOR.navRow);
  if (row instanceof HTMLElement) row.focus();
}

/** The menu button of the top bar that's showing (the open tab's, or the
    home screen's): it opens the drawer, or brings the sidebar back. */
const shownMenuButton = (): HTMLElement => find(currentTab() ?? byId(PAGE_IDS.home), CLASS_SELECTOR.menuButton);

/** Closes the drawer. Focus, if it was in the drawer, goes back to the
    menu button. */
export function closeDrawer(): void {
  const hadFocus = side.contains(document.activeElement);
  side.classList.remove(PAGE_CLASSES.drawerOpen);
  if (isAddressOnDrawer()) clearHash();
  if (hadFocus) shownMenuButton().focus();
}

// ---- Hiding it -------------------------------------------------------------------
// On wider screens the button before the name hides the sidebar, and the
// top bar's button brings it back. It shows again on every visit.

function setSidebarHidden(isHidden: boolean): void {
  shell.classList.toggle(PAGE_CLASSES.noSide, isHidden);
  hideButton.setAttribute("aria-expanded", String(!isHidden));
}

/** A top bar's menu button: opens the drawer, or brings the sidebar back. */
export function wireMenuButton(button: HTMLElement): void {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (!isWide()) return openDrawer();
    setSidebarHidden(false);
    hideButton.focus();
  });
}

// ---- Arrow keys between its rows (but not out of a menu) ------------------------

/** A group's heading: the button in it that folds the group (folding.ts). */
const GROUP_HEADING = `${CLASS_SELECTOR.groupHeading} ${CLASS_SELECTOR.foldButton}`;

/** The rows the arrow keys move between: "New tab" and the rows beside it,
    each group's heading, each tab's row, and the account row. */
const ARROW_KEY_ROWS = [SELECTOR.navRow, GROUP_HEADING, SELECTOR.tabRow, CLASS_SELECTOR.accountRow].join(", ");

function moveBetweenRows(event: KeyboardEvent): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  // A menu in the sidebar has arrow keys of its own.
  if (event.defaultPrevented || !(event.target instanceof Element) || event.target.closest(MENU)) return;
  // The rows of a folded group are skipped.
  const rowsShowing = findAll(side, ARROW_KEY_ROWS).filter((row) => !row.closest("[hidden]"));
  if (!isFocusOn(rowsShowing)) return;
  event.preventDefault();
  stepFocus(rowsShowing, event.key === "ArrowDown" ? 1 : -1);
}

// ---- Resizing ----------------------------------------------------------------------
// Its edge can be dragged (a blue line shows on hover), moved with the arrow
// keys, or double-clicked to go back to the default width. Remembered per
// browser.

/** The stylesheet's sidebar width: a custom property, set on the shell. */
const WIDTH_PROPERTY = "--sidebar-w";

/** The sidebar's edge. To screen readers it's a separator whose value is
    the sidebar's width. */
const resizer = make("div", {
  class: PAGE_CLASSES.resizer,
  role: "separator",
  tabindex: "0",
  "aria-orientation": "vertical",
  "aria-controls": PAGE_IDS.sidebar,
  "aria-label": words.resize,
  "aria-valuemin": String(SIZE.sidebarMin),
});

/** The widest the sidebar can be in the window as it is now: SIZE.sidebarMax,
    or less where that would leave the rest under SIZE.sidebarRoom (but
    never less than SIZE.sidebarMin). */
const widestNow = (): number => clamp(innerWidth - SIZE.sidebarRoom, SIZE.sidebarMin, SIZE.sidebarMax);

/** How wide the sidebar is showing now, in pixels. */
const widthShowing = (): number => side.getBoundingClientRect().width;

/** Sets the sidebar's width, kept within its narrowest and its widest now;
    null goes back to the stylesheet's own. Tells screen readers where the
    edge now is, and returns the width in whole pixels. */
function setWidth(px: number | null): number {
  if (px === null) shell.style.removeProperty(WIDTH_PROPERTY);
  else shell.style.setProperty(WIDTH_PROPERTY, `${Math.round(clamp(px, SIZE.sidebarMin, widestNow()))}px`);
  const widthNow = Math.round(widthShowing());
  resizer.setAttribute("aria-valuemax", String(widestNow()));
  resizer.setAttribute("aria-valuenow", String(widthNow));
  return widthNow;
}

/** Sets the width, and remembers it for the next visit ("" for the
    stylesheet's own). */
function setAndRememberWidth(px: number | null): void {
  const widthNow = setWidth(px);
  local.set(STORAGE.sidebarWidth, px === null ? "" : String(widthNow));
}

/** The width this browser remembers, kept within the room the window
    leaves as it changes. */
function restoreWidth(): void {
  const remembered = Number(local.get(STORAGE.sidebarWidth));
  setWidth(remembered > 0 ? remembered : null);
}

/** The edge follows the pointer. A click that doesn't move leaves the width
    as it was, and unsaved. */
function dragResizer(down: PointerEvent): void {
  const sidebarLeft = side.getBoundingClientRect().left;
  let hasMoved = false;
  const moveEdgeToPointer = (move: PointerEvent) => {
    hasMoved = true;
    setWidth(move.clientX - sidebarLeft);
  };
  const letGo = () => {
    shell.classList.remove(PAGE_CLASSES.resizing);
    if (hasMoved) setAndRememberWidth(widthShowing());
  };
  shell.classList.add(PAGE_CLASSES.resizing);
  followPointer(resizer, down, moveEdgeToPointer, letGo);
}

/** How far an arrow key moves the edge: left narrows the sidebar, right
    widens it. 0 for any other key. */
function arrowKeyStep(key: string): number {
  if (key === "ArrowLeft") return -SIZE.sidebarStep;
  if (key === "ArrowRight") return SIZE.sidebarStep;
  return 0;
}

/** Puts the edge beside the sidebar, at the width this browser remembers. */
function addResizer(): void {
  side.after(resizer);
  restoreWidth();
  addEventListener("resize", restoreWidth);

  resizer.addEventListener("pointerdown", (event) => {
    const isMainButton = event.button === 0;
    if (!isMainButton) return;
    event.preventDefault();
    dragResizer(event);
  });
  resizer.addEventListener("dblclick", () => setAndRememberWidth(null));
  resizer.addEventListener("keydown", (event) => {
    const step = arrowKeyStep(event.key);
    if (!step) return;
    event.preventDefault();
    setAndRememberWidth(widthShowing() + step);
  });
}

/** Wires the sidebar's own buttons, the arrow keys between its rows, and
    its edge. (A top bar's menu button is wired with its tab: wireMenuButton.) */
export function initSidebar(): void {
  hideButton.addEventListener("click", () => {
    setSidebarHidden(true);
    shownMenuButton().focus();
  });
  // A tap on the dimmed page behind the drawer (the shell's ::after) closes it.
  shell.addEventListener("click", (event) => {
    if (event.target === shell) closeDrawer();
  });
  find(side, CLASS_SELECTOR.drawerClose).addEventListener("click", (event) => {
    event.preventDefault();
    closeDrawer();
  });
  side.addEventListener("keydown", moveBetweenRows);
  addResizer();
}
