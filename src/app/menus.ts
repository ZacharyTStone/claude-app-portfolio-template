/* Menus, one open at a time (the question card is one too): arrow keys and
   a row's letter pick a row, Escape or a click elsewhere closes it, and a
   row with › opens a submenu beside it. */
import { DATA } from "../shared/page-data.ts";
import { CLASS, SELECTOR, SIZE, TIMING } from "./constants.ts";
import { findAll, make } from "./lib/dom.ts";

type OpenMenu = { menu: HTMLElement; trigger: HTMLElement };
let openMenu: OpenMenu | null = null;

/** A button's attributes for the menu (or dialog) it opens. */
export const popupAttributes = (controls: string, kind = "menu"): Record<string, string> => ({
  "aria-haspopup": kind,
  "aria-expanded": "false",
  "aria-controls": controls,
});

/** Whether a menu is open. */
export const isMenuOpen = (): boolean => openMenu !== null;

/** Whether the open menu is the one this button opened. */
export const isOpenFrom = (trigger: HTMLElement): boolean => openMenu?.trigger === trigger;

/** A menu's own rows that can be chosen, not those of a submenu inside it. */
export const menuItems = (menu: HTMLElement): HTMLElement[] =>
  findAll(menu, '[role="menuitem"]:not([aria-disabled="true"])').filter(
    (item) => item.closest('[role="menu"]') === menu,
  );

const hideSubmenu = new WeakMap<Element, () => void>();

export function closeMenu(refocus: boolean): void {
  if (!openMenu) return;
  const { menu, trigger } = openMenu;
  openMenu = null;
  menu.hidden = true;
  for (const sub of menu.querySelectorAll(SELECTOR.submenu)) hideSubmenu.get(sub)?.();
  trigger.setAttribute("aria-expanded", "false");
  if (refocus) trigger.focus();
}

type ToggleOptions = {
  /** Fills and places the menu before it shows. */
  build?: () => void;
  /** What gets focus once it's open (its first row, otherwise). */
  focus?: () => HTMLElement | undefined;
};

/** Opens `menu` from `trigger`, or closes it if that's how it's open. */
export function toggleMenu(menu: HTMLElement, trigger: HTMLElement, { build, focus }: ToggleOptions = {}): void {
  if (openMenu?.menu === menu && openMenu.trigger === trigger) return closeMenu(false);
  closeMenu(false);
  build?.();
  menu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  openMenu = { menu, trigger };
  (focus ? focus() : menuItems(menu)[0])?.focus();
}

/** Gives a menu its keys, and closes it when one of its items is chosen. */
export function asMenu(menu: HTMLElement): void {
  menu.addEventListener("keydown", (event) => {
    if (!(event.target instanceof Element) || event.target.closest('[role="menu"]') !== menu) return; // a submenu's own
    const items = menuItems(menu);
    const at = items.findIndex((item) => item === document.activeElement);
    const active = document.activeElement;
    let next: HTMLElement | undefined;
    if (event.key === "ArrowDown") next = items[(at + 1) % items.length];
    else if (event.key === "ArrowUp") next = items[(at - 1 + items.length) % items.length];
    else if (event.key === "Home") next = items[0];
    else if (event.key === "End") next = items.at(-1);
    else if (event.key === "Tab") return closeMenu(false);
    else if (event.key === " " && active instanceof HTMLAnchorElement) {
      event.preventDefault();
      return active.click();
    } else if (/^[a-z]$/i.test(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const hit = items.find((item) => item.getAttribute(DATA.key) === event.key.toLowerCase());
      if (!hit) return;
      event.preventDefault();
      return hit.click();
    } else return;
    event.preventDefault();
    next?.focus();
  });
  // Closed (focus back on its button) before the row does what it does,
  // which may move focus, or open another menu.
  menu.addEventListener(
    "click",
    (event) => {
      const item = event.target instanceof Element ? event.target.closest('[role="menuitem"]') : null;
      if (!item || item.hasAttribute("aria-haspopup") || item.getAttribute("aria-disabled") === "true") return;
      closeMenu(true);
    },
    { capture: true },
  );
}

type RowOptions = { key?: string; href?: string; hreflang?: string; lang?: string; class?: string };

/** A menu row: a link with `href`, otherwise a button; `key` is its letter. */
export function menuRow(label: string, { key, ...attributes }: RowOptions = {}): HTMLElement {
  return make(
    attributes.href ? "a" : "button",
    {
      type: attributes.href ? null : "button",
      role: "menuitem",
      tabindex: "-1",
      [DATA.key]: key,
      ...attributes,
    },
    make("span", { class: "opt" }, label),
    ...(key ? [make("span", { class: "key", "aria-hidden": "true" }, key.toUpperCase())] : []),
  );
}

// How far right a menu can reach: the window's edge, or that of a box
// around it that clips (the sidebar scrolls, so it cuts off what sticks out
// of it).
function rightEdge(el: HTMLElement): number {
  let edge = innerWidth;
  for (let box = el.parentElement; box; box = box.parentElement) {
    if (getComputedStyle(box).overflowX === "visible") continue;
    edge = Math.min(edge, box.getBoundingClientRect().left + box.clientLeft + box.clientWidth);
  }
  return edge - SIZE.edge;
}

/** Makes `item` a row with › that opens a submenu beside it (or below it,
    where there's no room), on hover, a click, or the right arrow key.
    `build` fills it each time it opens. */
export function withSubmenu(item: HTMLElement, menu: HTMLElement, build: (sub: HTMLElement) => void): void {
  const sub = make("div", { class: `pop ${CLASS.submenu}`, role: "menu", hidden: "" });
  item.setAttribute("aria-haspopup", "menu");
  item.setAttribute("aria-expanded", "false");
  item.append(make("span", { class: "chev", "aria-hidden": "true" }));
  let timer = 0;
  const hide = () => {
    sub.hidden = true;
    item.setAttribute("aria-expanded", "false");
  };
  const show = (focus: boolean) => {
    clearTimeout(timer);
    if (sub.hidden) {
      build(sub);
      for (const row of menuItems(sub)) row.tabIndex = -1;
      sub.hidden = false;
      item.setAttribute("aria-expanded", "true");
      place(sub, item, menu);
    }
    if (focus) menuItems(sub)[0]?.focus();
  };
  hideSubmenu.set(sub, hide);

  // A click opens it (hovering has usually opened it already, so a toggle
  // would close it again); from the keyboard it also moves into it.
  item.addEventListener("click", (event) => show(event.detail === 0));
  item.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") show(false);
  });
  for (const el of [item, sub]) {
    el.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") timer = setTimeout(hide, TIMING.submenuLinger);
    });
  }
  sub.addEventListener("pointerenter", () => clearTimeout(timer));
  item.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight") return;
    event.preventDefault();
    show(true);
  });
  asMenu(sub);
  sub.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    hide();
    item.focus();
  });
  menu.append(sub);
}

// A submenu beside its row, or below it when there's no room beside it,
// and then never past the edge.
function place(sub: HTMLElement, item: HTMLElement, menu: HTMLElement): void {
  sub.classList.remove(CLASS.below);
  sub.style.left = "";
  sub.style.top = `${item.offsetTop - SIZE.menuPadding}px`;
  const edge = rightEdge(menu);
  if (sub.getBoundingClientRect().right <= edge) return;
  sub.classList.add(CLASS.below);
  sub.style.top = `${item.offsetTop + item.offsetHeight}px`;
  const over = sub.getBoundingClientRect().right - edge;
  if (over > 0) sub.style.left = `${sub.offsetLeft - over}px`;
}

/** A click outside the open menu (and its button) closes it, as it comes
    in: before what was clicked can open another menu, which it then
    leaves open. Escape is main.ts's, as it closes the open menu or else the
    phone drawer. */
export function initMenus(): void {
  addEventListener(
    "click",
    (event) => {
      const path = event.composedPath();
      if (openMenu && !path.includes(openMenu.menu) && !path.includes(openMenu.trigger)) closeMenu(false);
    },
    { capture: true },
  );
}
