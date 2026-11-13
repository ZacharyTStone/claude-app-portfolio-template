/* The sidebar: on a phone, a drawer; on wider screens it can be hidden, and
   resized by its edge (sidebar-resizer.ts). Arrow keys move between its
   rows. */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { PAGE_IDS } from "../contracts/page-ids.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { SIZE } from "./constants.ts";
import { byId, find, findAll, onClick } from "./lib/dom.ts";
import { isFocusOn, stepFocus } from "./lib/focus.ts";
import { MENU } from "./menu.ts";
import { shell, sidebar } from "./page.ts";
import { addSidebarResizer } from "./sidebar-resizer.ts";
import { clearHash, currentTab } from "./tabs.ts";

const widerThanPhone = matchMedia(`(min-width: ${SIZE.wide}px)`);

/** The button before the name, which hides the sidebar on wider screens. */
const hideButton = find(sidebar, ATTRIBUTE_SELECTOR.sideToggle);

/** A group's heading: the button in it that folds the group (folding.ts). */
const GROUP_HEADING = `${CLASS_SELECTOR.groupHeading} ${CLASS_SELECTOR.foldButton}`;

/** "New tab" and the rows beside it, each group's heading, each tab's row,
    and the account row. */
const ARROW_KEY_ROWS = [PART_SELECTOR.navRow, GROUP_HEADING, PART_SELECTOR.tabRow, CLASS_SELECTOR.accountRow].join(
  ", ",
);

export function initSidebar(): void {
  onClick(CLASS_SELECTOR.menuButton, (_menuButton, event) => {
    // Without JavaScript it's a link to the sidebar (#tabs).
    event.preventDefault();
    if (isWide()) showSidebar();
    else openDrawer();
  });
  hideButton.addEventListener("click", hideSidebar);
  // A tap on the dimmed page behind the drawer (the shell's ::after).
  shell.addEventListener("click", (event) => {
    if (event.target === shell) closeDrawerAndReturnFocus();
  });
  find(sidebar, CLASS_SELECTOR.drawerClose).addEventListener("click", (event) => {
    event.preventDefault();
    closeDrawerAndReturnFocus();
  });
  sidebar.addEventListener("keydown", moveBetweenRows);
  addSidebarResizer();
}

/** Wider than a phone, where the sidebar is beside the tab, not a drawer. */
export const isWide = (): boolean => widerThanPhone.matches;

/** The address alone (#tabs) opens the drawer, as it does without
    JavaScript. */
export const isAddressOnDrawer = (): boolean => sidebar.matches(":target");

/** By its button (a class keeps the open tab where it is behind it), or by
    the address. */
export const isDrawerOpen = (): boolean => sidebar.classList.contains(PAGE_CLASSES.drawerOpen) || isAddressOnDrawer();

/** Closes the drawer however it was opened: an address that opened it is
    cleared. */
export function closeDrawer(): void {
  sidebar.classList.remove(PAGE_CLASSES.drawerOpen);
  if (isAddressOnDrawer()) clearHash();
}

/** For a drawer closed from inside it: the focus, if it was in the drawer,
    goes back to the menu button. */
export function closeDrawerAndReturnFocus(): void {
  const hadFocus = sidebar.contains(document.activeElement);
  closeDrawer();
  if (hadFocus) shownMenuButton().focus();
}

/** The focus goes to the open tab's row, or else to the first row. */
function openDrawer(): void {
  sidebar.classList.add(PAGE_CLASSES.drawerOpen);
  const row = sidebar.querySelector('[aria-current="page"]') ?? sidebar.querySelector(PART_SELECTOR.navRow);
  if (row instanceof HTMLElement) row.focus();
}

/** It shows again on every visit. */
function hideSidebar(): void {
  shell.classList.add(PAGE_CLASSES.noSide);
  hideButton.setAttribute("aria-expanded", "false");
  shownMenuButton().focus();
}

function showSidebar(): void {
  shell.classList.remove(PAGE_CLASSES.noSide);
  hideButton.setAttribute("aria-expanded", "true");
  hideButton.focus();
}

/** The menu button of the top bar that's showing: the open tab's, or the
    home screen's. */
const shownMenuButton = (): HTMLElement => find(currentTab() ?? byId(PAGE_IDS.home), CLASS_SELECTOR.menuButton);

function moveBetweenRows(event: KeyboardEvent): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  // A menu in the sidebar has arrow keys of its own.
  if (event.defaultPrevented || !(event.target instanceof Element) || event.target.closest(MENU)) return;
  // The rows of a folded group are skipped.
  const rowsShowing = findAll(sidebar, ARROW_KEY_ROWS).filter((row) => !row.closest("[hidden]"));
  if (!isFocusOn(rowsShowing)) return;
  event.preventDefault();
  stepFocus(rowsShowing, event.key === "ArrowDown" ? 1 : -1);
}
