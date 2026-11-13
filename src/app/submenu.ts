/* A menu row with › opens a submenu beside it: on hover, a click, or the
   right arrow key. */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { SIZE } from "./constants.ts";
import { make } from "./lib/dom.ts";
import { asMenu, menuItems } from "./menu.ts";

/** How long a submenu stays after the mouse leaves it. */
const LINGER_MS = 250;

/** A menu's padding in the stylesheet: a submenu moves up by this, so its
    first row is level with the row that opens it. */
const MENU_PADDING_PX = 6;

type Submenu = {
  /** A menu inside the menu its row is in. */
  popup: HTMLElement;
  /** The row with › that opens it. */
  row: HTMLElement;
  parentMenu: HTMLElement;
  /** Fills the submenu with its rows, each time it opens. */
  fill: (popup: HTMLElement) => void;
  /** Hides it a moment after the mouse leaves it. */
  lingerTimer: number;
};

/** Makes `row` open a submenu of `menu`, beside the row or, where there's
    no room, below it. */
export function withSubmenu(row: HTMLElement, menu: HTMLElement, fill: (popup: HTMLElement) => void): void {
  const popup = make("div", { class: `pop ${PAGE_CLASSES.submenu}`, role: "menu", hidden: "" });
  row.setAttribute("aria-haspopup", "menu");
  row.setAttribute("aria-expanded", "false");
  row.append(make("span", { class: "chevron", "aria-hidden": "true" }));
  const submenu: Submenu = { popup, row, parentMenu: menu, fill, lingerTimer: 0 };

  openOnClick(submenu);
  openOnHover(submenu);
  row.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight") return;
    event.preventDefault();
    enterSubmenu(submenu);
  });
  asMenu(popup);
  goBackToRowByKey(submenu);
  menu.append(popup);
}

/** A click shows it and never hides it: hovering has usually shown it
    already, so a toggle would close it again. From the keyboard the click
    also moves into it. */
function openOnClick(submenu: Submenu): void {
  submenu.row.addEventListener("click", (event) => {
    // A click that a key made counts no presses of a mouse button.
    const cameFromKeyboard = event.detail === 0;
    if (cameFromKeyboard) enterSubmenu(submenu);
    else showSubmenu(submenu);
  });
}

/** The mouse opens a submenu by hovering over its row, and leaves it open
    for a moment after it leaves the row or the submenu: long
    enough to cross from one to the other. Touch has no hover: it clicks. */
function openOnHover(submenu: Submenu): void {
  const { popup, row } = submenu;
  row.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") showSubmenu(submenu);
  });
  for (const part of [row, popup]) {
    part.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse") return;
      submenu.lingerTimer = setTimeout(() => hideSubmenu(submenu), LINGER_MS);
    });
  }
  popup.addEventListener("pointerenter", () => clearTimeout(submenu.lingerTimer));
}

/** The left arrow or Escape goes back to the row. The key stops here, so
    Escape closes the submenu alone, not the menu it's in. */
function goBackToRowByKey(submenu: Submenu): void {
  submenu.popup.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    hideSubmenu(submenu);
    submenu.row.focus();
  });
}

function enterSubmenu(submenu: Submenu): void {
  showSubmenu(submenu);
  menuItems(submenu.popup)[0]?.focus();
}

/** Shows a submenu, filled afresh unless it's showing already. */
function showSubmenu(submenu: Submenu): void {
  const { popup, row } = submenu;
  clearTimeout(submenu.lingerTimer);
  if (!popup.hidden) return;
  submenu.fill(popup);
  for (const item of menuItems(popup)) item.tabIndex = -1;
  popup.hidden = false;
  row.setAttribute("aria-expanded", "true");
  placeSubmenu(submenu);
}

function hideSubmenu({ popup, row }: Submenu): void {
  popup.hidden = true;
  row.setAttribute("aria-expanded", "false");
}

/** Puts a submenu beside its row, its first row level with it; or, when
    there's no room beside it, below its row, and then never past the edge. */
function placeSubmenu({ popup, row, parentMenu }: Submenu): void {
  popup.classList.remove(PAGE_CLASSES.below);
  popup.style.left = "";
  popup.style.top = `${row.offsetTop - MENU_PADDING_PX}px`;
  const rightLimit = rightLimitFor(parentMenu);
  if (popup.getBoundingClientRect().right <= rightLimit) return;
  popup.classList.add(PAGE_CLASSES.below);
  popup.style.top = `${row.offsetTop + row.offsetHeight}px`;
  const overhang = popup.getBoundingClientRect().right - rightLimit;
  if (overhang > 0) popup.style.left = `${popup.offsetLeft - overhang}px`;
}

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
