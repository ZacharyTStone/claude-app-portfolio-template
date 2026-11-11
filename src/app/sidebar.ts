/* The sidebar: on a phone, a drawer; on wider screens it can be hidden and
   resized. Arrow keys move between its rows. */
import { PAGE_IDS } from "../shared/page-data.ts";
import { CLASS, SELECTOR, SIZE, STORAGE } from "./constants.ts";
import { byId, find, findAll, make } from "./lib/dom.ts";
import { local } from "./lib/storage.ts";
import { app, side, words } from "./page.ts";
import { clearHash, currentTab } from "./tabs.ts";

const wide = matchMedia(`(min-width: ${SIZE.wide}px)`);
const sideToggle = find(side, SELECTOR.sideToggle);

/** Wider than a phone, where the sidebar is beside the tab, not a drawer. */
export const isWide = (): boolean => wide.matches;

// ---- The phone drawer ------------------------------------------------------------
// Without JavaScript the menu button targets the sidebar, which hides the
// open tab behind it; a class keeps the tab where it is. It can also be
// open because the address is #tabs (from before this file ran, or the
// back button); closing it then clears the address.

export const drawerOpen = (): boolean => side.classList.contains(CLASS.drawerOpen) || side.matches(":target");

function openDrawer(): void {
  side.classList.add(CLASS.drawerOpen);
  const row = side.querySelector('[aria-current="page"]') ?? side.querySelector(SELECTOR.navRow);
  if (row instanceof HTMLElement) row.focus();
}

// The top bar's button that opens the drawer, or brings the sidebar back.
const menuButton = (): HTMLElement => find(currentTab() ?? byId(PAGE_IDS.top), SELECTOR.menuButton);

export function closeDrawer(): void {
  const hadFocus = side.contains(document.activeElement);
  side.classList.remove(CLASS.drawerOpen);
  if (side.matches(":target")) clearHash();
  if (hadFocus) menuButton().focus();
}

// ---- Hiding it -------------------------------------------------------------------
// On wider screens the button before the name hides the sidebar, and the
// top bar's button brings it back. It shows again on every visit.

function setSide(hidden: boolean): void {
  app.classList.toggle(CLASS.noSide, hidden);
  sideToggle.setAttribute("aria-expanded", String(!hidden));
}

/** A top bar's menu button: opens the drawer, or brings the sidebar back. */
export function wireMenuButton(button: HTMLElement): void {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (!isWide()) return openDrawer();
    setSide(false);
    sideToggle.focus();
  });
}

// ---- Arrow keys between its rows (but not out of a menu) ------------------------

const ROWS = [SELECTOR.navRow, `${SELECTOR.group} ${SELECTOR.foldButton}`, SELECTOR.tabRow, SELECTOR.me].join(", ");

function moveBetweenRows(event: KeyboardEvent): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  if (event.defaultPrevented || !(event.target instanceof Element) || event.target.closest('[role="menu"]')) return;
  const rows = findAll(side, ROWS).filter((row) => !row.closest("[hidden]"));
  const at = rows.findIndex((row) => row === document.activeElement);
  if (at === -1) return;
  event.preventDefault();
  rows[(at + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length]?.focus();
}

// ---- Resizing ----------------------------------------------------------------------
// Its edge can be dragged (a blue line shows on hover), moved with the arrow
// keys, or double-clicked to go back to the default width. Remembered per
// browser.

// The stylesheet's sidebar width.
const WIDTH = "--sidebar-w";
const maxWidth = () => Math.max(SIZE.sidebarMin, Math.min(SIZE.sidebarMax, innerWidth - SIZE.sidebarRoom));

// The edge follows the pointer. A click that doesn't move leaves the width
// as it was, and unsaved.
function dragEdge(edge: HTMLElement, down: PointerEvent, setWidth: (px: number, remember: boolean) => void): void {
  const left = side.getBoundingClientRect().left;
  let moved = false;
  const move = (e: PointerEvent) => {
    moved = true;
    setWidth(e.clientX - left, false);
  };
  const end = () => {
    app.classList.remove(CLASS.resizing);
    edge.removeEventListener("pointermove", move);
    edge.removeEventListener("pointerup", end);
    edge.removeEventListener("pointercancel", end);
    if (moved) setWidth(side.getBoundingClientRect().width, true);
  };
  app.classList.add(CLASS.resizing);
  edge.setPointerCapture(down.pointerId);
  edge.addEventListener("pointermove", move);
  edge.addEventListener("pointerup", end);
  edge.addEventListener("pointercancel", end);
}

function addResizer(): void {
  const edge = make("div", {
    class: CLASS.resizer,
    role: "separator",
    tabindex: "0",
    "aria-orientation": "vertical",
    "aria-controls": PAGE_IDS.tabs,
    "aria-label": words.resize,
    "aria-valuemin": String(SIZE.sidebarMin),
  });
  side.after(edge);

  // null for the default width.
  const setWidth = (px: number | null, remember: boolean) => {
    if (px === null) app.style.removeProperty(WIDTH);
    else app.style.setProperty(WIDTH, `${Math.round(Math.min(maxWidth(), Math.max(SIZE.sidebarMin, px)))}px`);
    const now = Math.round(side.getBoundingClientRect().width);
    edge.setAttribute("aria-valuemax", String(maxWidth()));
    edge.setAttribute("aria-valuenow", String(now));
    if (remember) local.set(STORAGE.sidebarWidth, px === null ? "" : String(now));
  };
  // The saved width, kept within the room the window leaves as it changes.
  const restore = () => {
    const saved = Number(local.get(STORAGE.sidebarWidth));
    setWidth(saved > 0 ? saved : null, false);
  };
  restore();
  addEventListener("resize", restore);

  edge.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragEdge(edge, event, setWidth);
  });
  edge.addEventListener("dblclick", () => setWidth(null, true));
  edge.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowLeft" ? -SIZE.sidebarStep : event.key === "ArrowRight" ? SIZE.sidebarStep : 0;
    if (!step) return;
    event.preventDefault();
    setWidth(side.getBoundingClientRect().width + step, true);
  });
}

export function initSidebar(): void {
  sideToggle.addEventListener("click", () => {
    setSide(true);
    menuButton().focus();
  });
  // A tap on the dimmed page behind the drawer (the shell's ::after) closes it.
  app.addEventListener("click", (event) => {
    if (event.target === app) closeDrawer();
  });
  find(side, SELECTOR.drawerClose).addEventListener("click", (event) => {
    event.preventDefault();
    closeDrawer();
  });
  side.addEventListener("keydown", moveBetweenRows);
  addResizer();
}
