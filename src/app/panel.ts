/* The details panel on the right: shown and hidden (it shows again on every
   visit), and sections that fold and can be dragged into another order by
   their grips (remembered per browser). */
import { isArrayOf, isString } from "../shared/guards.ts";
import { CLASS, SELECTOR, STORAGE, TIMING } from "./constants.ts";
import { findAll, make } from "./lib/dom.ts";
import { reducedMotion } from "./lib/motion.ts";
import { local } from "./lib/storage.ts";
import { foldable } from "./folding.ts";
import { app, panel, words } from "./page.ts";
import { closeViewer, isViewerOpen } from "./viewer.ts";

const isHidden = () => app.classList.contains(CLASS.noPanel);

function setPanel(hidden: boolean): void {
  app.classList.toggle(CLASS.noPanel, hidden);
  for (const button of document.querySelectorAll(SELECTOR.panelToggle)) {
    button.setAttribute("aria-expanded", String(!hidden));
  }
}

/** A button that shows or hides the panel. While the viewer is in the
    panel's place, it brings the panel back instead. */
export function wirePanelToggle(button: HTMLElement): void {
  button.setAttribute("aria-expanded", String(!isHidden()));
  button.addEventListener("click", () => {
    if (!isViewerOpen()) return setPanel(!isHidden());
    closeViewer({ keepFocus: true });
    setPanel(false);
  });
}

// ---- Dragging its sections ---------------------------------------------------------

const sections = () => findAll(panel, SELECTOR.panelSection);
const saveOrder = () =>
  local.setJson(
    STORAGE.panelOrder,
    sections().map((section) => section.getAttribute("aria-labelledby")),
  );
const sectionAbove = (section: HTMLElement) =>
  section.previousElementSibling instanceof HTMLElement && section.previousElementSibling.matches("section")
    ? section.previousElementSibling
    : null;
const sectionBelow = (section: HTMLElement) =>
  section.nextElementSibling instanceof HTMLElement ? section.nextElementSibling : null;

// The sections in the order this browser left them.
function restoreOrder(): void {
  const saved = local.getJson(STORAGE.panelOrder);
  for (const id of isArrayOf(saved, isString) ? saved : []) {
    const section = panel.querySelector(`${SELECTOR.panelSection}[aria-labelledby="${CSS.escape(id)}"]`);
    if (section) panel.append(section);
  }
}

// Gives a section a six-dot grip, to drag it into another order; the
// arrow keys on it move it too.
function draggable(section: HTMLElement): void {
  const label = words.moveSection.replace("{name}", section.querySelector(SELECTOR.panelHeading)?.textContent ?? "");
  const grip = make("button", { type: "button", class: `${CLASS.grip} ic i-grip`, "aria-label": label, title: label });
  section.append(grip);
  grip.addEventListener("keydown", (event) => {
    const above = sectionAbove(section);
    const below = sectionBelow(section);
    if (event.key === "ArrowUp" && above) above.before(section);
    else if (event.key === "ArrowDown" && below) below.after(section);
    else return;
    event.preventDefault();
    grip.focus();
    saveOrder();
  });
  grip.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag(section, grip, event);
  });
}

// A section settling into place after a drag or a slide, by its timer: a
// drag that starts before it has settled stops it.
const settling = new WeakMap<HTMLElement, number>();

function settle(el: HTMLElement, done?: () => void): void {
  const timer = setTimeout(() => {
    el.style.transition = "";
    el.style.translate = "";
    done?.();
  }, TIMING.settle);
  settling.set(el, timer);
}

// The dragged section follows the pointer; when its middle passes a
// neighbour's, the neighbour slides into the gap it leaves. Only the
// neighbours move in the page, so the dragged section keeps the pointer.
function drag(section: HTMLElement, grip: HTMLElement, down: PointerEvent): void {
  const ease = reducedMotion() ? "none" : `translate ${TIMING.slide}ms cubic-bezier(0.4, 0, 0.2, 1)`;
  let start = down.clientY;
  let dy = 0;
  clearTimeout(settling.get(section));
  section.classList.add(CLASS.dragging);
  section.style.transition = "none";
  const slide = (other: HTMLElement, reorder: () => void) => {
    const mine = section.offsetTop;
    const theirs = other.offsetTop;
    reorder();
    const moved = section.offsetTop - mine;
    start += moved;
    dy -= moved;
    section.style.translate = `0 ${dy}px`;
    other.style.transition = "none";
    other.style.translate = `0 ${theirs - other.offsetTop}px`;
    other.getBoundingClientRect(); // so it starts from there
    other.style.transition = ease;
    other.style.translate = "0 0";
    settle(other);
  };
  const move = (e: PointerEvent) => {
    dy = e.clientY - start;
    section.style.translate = `0 ${dy}px`;
    const middle = section.offsetTop + dy + section.offsetHeight / 2;
    const below = sectionBelow(section);
    const above = sectionAbove(section);
    if (below && middle > below.offsetTop + below.offsetHeight / 2) slide(below, () => section.before(below));
    else if (above && middle < above.offsetTop + above.offsetHeight / 2) slide(above, () => section.after(above));
  };
  const end = () => {
    grip.removeEventListener("pointermove", move);
    grip.removeEventListener("pointerup", end);
    grip.removeEventListener("pointercancel", end);
    // Settle into place, then put it down.
    section.style.transition = ease;
    section.style.translate = "0 0";
    settle(section, () => section.classList.remove(CLASS.dragging));
    saveOrder();
  };
  // The grip keeps the pointer as the sections move under it.
  grip.setPointerCapture(down.pointerId);
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
}

/** Folding sections, in the order this browser left them, with grips. */
export function initPanel(): void {
  findAll(panel, SELECTOR.panelHeading).forEach(foldable);
  restoreOrder();
  sections().forEach(draggable);
}
