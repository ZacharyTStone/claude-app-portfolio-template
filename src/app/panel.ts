/* The details panel on the right: shown and hidden (it shows again on every
   visit), and sections that fold and can be dragged into another order by
   their grips (remembered per browser). */
import { isArrayOf, isString } from "../contracts/guards.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { SELECTOR, STORAGE, TIMING } from "./constants.ts";
import { findAll, make } from "./lib/dom.ts";
import { followPointer } from "./lib/drag.ts";
import { isMotionReduced } from "./lib/motion.ts";
import { local } from "./lib/storage.ts";
import { foldable } from "./folding.ts";
import { detailsPanel, shell, words } from "./page.ts";
import { closeViewer, isViewerOpen } from "./viewer.ts";

// ---- Showing and hiding it ---------------------------------------------------------

const isPanelHidden = (): boolean => shell.classList.contains(PAGE_CLASSES.noPanel);

/** Hides the panel or shows it, and tells every button that does so (one
    in each top bar, and the panel's own) which it is now. */
function setPanelHidden(isHidden: boolean): void {
  shell.classList.toggle(PAGE_CLASSES.noPanel, isHidden);
  for (const button of document.querySelectorAll(SELECTOR.panelToggle)) {
    button.setAttribute("aria-expanded", String(!isHidden));
  }
}

/** A button that shows or hides the panel. While the viewer is in the
    panel's place, it brings the panel back instead. */
export function wirePanelToggle(button: HTMLElement): void {
  button.setAttribute("aria-expanded", String(!isPanelHidden()));
  button.addEventListener("click", () => {
    if (!isViewerOpen()) return setPanelHidden(!isPanelHidden());
    closeViewer({ keepFocus: true });
    setPanelHidden(false);
  });
}

// ---- The order of its sections -----------------------------------------------------

const panelSections = (): HTMLElement[] => findAll(detailsPanel, SELECTOR.panelSection);

/** The section just above this one, if there is one. (Above the panel's
    first section is its close button, which isn't one.) */
const sectionAbove = (section: HTMLElement): HTMLElement | null =>
  section.previousElementSibling instanceof HTMLElement && section.previousElementSibling.matches("section")
    ? section.previousElementSibling
    : null;

/** The section just below this one, if there is one: the sections are the
    last things in the panel. */
const sectionBelow = (section: HTMLElement): HTMLElement | null =>
  section.nextElementSibling instanceof HTMLElement ? section.nextElementSibling : null;

/** Remembers the order the sections are in, by the ids of their headings. */
function rememberSectionOrder(): void {
  const headingIds = panelSections().map((section) => section.getAttribute("aria-labelledby"));
  local.setJson(STORAGE.panelOrder, headingIds);
}

/** Puts the sections in the order this browser left them. A section it
    doesn't remember (one added to the site since) stays ahead of those it
    does. */
function restoreSectionOrder(): void {
  const remembered = local.getJson(STORAGE.panelOrder);
  for (const headingId of isArrayOf(remembered, isString) ? remembered : []) {
    const section = detailsPanel.querySelector(`${SELECTOR.panelSection}[aria-labelledby="${CSS.escape(headingId)}"]`);
    if (section) detailsPanel.append(section);
  }
}

// ---- Dragging a section ------------------------------------------------------------
// The dragged section follows the pointer; when its middle passes a
// neighbour's, the neighbour slides into the gap it leaves. Only the
// neighbours move in the page, so the dragged section keeps the pointer.

/** How a section's slide into place eases: fast, then gently to rest. */
const SLIDE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

/** A section being dragged by its grip. */
type SectionDrag = {
  section: HTMLElement;
  /** Where the pointer is, down the window (its clientY), when the section
      sits exactly where the page has it. It starts where the pointer went
      down, and moves each time the section swaps places with a neighbour. */
  restingPointerY: number;
  /** How far down from where the page has it the section is shown, in
      pixels (up is negative). */
  offsetY: number;
  /** The CSS transition a section slides into place with: none with
      motion reduced. */
  slideTransition: string;
};

/** The timer of each section that's settling into place after a drag or a
    slide. */
const settleTimers = new WeakMap<HTMLElement, number>();

/** Shows a section `offsetY` pixels down from where the page has it. */
function showOffset(section: HTMLElement, offsetY: number): void {
  section.style.translate = `0 ${offsetY}px`;
}

/** Once a section has had time to slide into place (TIMING.settle), takes
    away what the drag put on it, then runs `onSettled`. */
function settleLater(section: HTMLElement, onSettled?: () => void): void {
  const timer = setTimeout(() => {
    section.style.transition = "";
    section.style.translate = "";
    onSettled?.();
  }, TIMING.settle);
  settleTimers.set(section, timer);
}

/** How far down the panel a section's middle is, as the page has it. */
const middleOf = (section: HTMLElement): number => section.offsetTop + section.offsetHeight / 2;

/** Swaps the dragged section with a neighbour it has passed (`reorder`
    moves one past the other in the page). The page then has the dragged
    section somewhere new, so what it's shown moved by, and where the
    pointer rests, change by as much: it stays under the pointer. The
    neighbour slides from where it was into the gap. */
function swapWithNeighbour(drag: SectionDrag, neighbour: HTMLElement, reorder: () => void): void {
  const { section } = drag;
  const sectionTopBefore = section.offsetTop;
  const neighbourTopBefore = neighbour.offsetTop;
  reorder();
  const sectionMovedBy = section.offsetTop - sectionTopBefore;
  drag.restingPointerY += sectionMovedBy;
  drag.offsetY -= sectionMovedBy;
  showOffset(section, drag.offsetY);

  neighbour.style.transition = "none";
  showOffset(neighbour, neighbourTopBefore - neighbour.offsetTop);
  // Reading its box makes the browser put it there now, so the slide
  // starts from where it was.
  neighbour.getBoundingClientRect();
  neighbour.style.transition = drag.slideTransition;
  neighbour.style.translate = "0 0";
  settleLater(neighbour);
}

/** Moves the dragged section to the pointer, and swaps it with the
    neighbour below or above once its middle has passed theirs. */
function dragTo(drag: SectionDrag, pointerY: number): void {
  const { section } = drag;
  drag.offsetY = pointerY - drag.restingPointerY;
  showOffset(section, drag.offsetY);
  const middleShown = section.offsetTop + drag.offsetY + section.offsetHeight / 2;
  const below = sectionBelow(section);
  const above = sectionAbove(section);
  if (below && middleShown > middleOf(below)) swapWithNeighbour(drag, below, () => section.before(below));
  else if (above && middleShown < middleOf(above)) swapWithNeighbour(drag, above, () => section.after(above));
}

/** Lets the dragged section go: it slides into the place the page now has
    it, is put down once it's there, and the new order is remembered. */
function drop(drag: SectionDrag): void {
  const { section } = drag;
  section.style.transition = drag.slideTransition;
  section.style.translate = "0 0";
  settleLater(section, () => section.classList.remove(PAGE_CLASSES.dragging));
  rememberSectionOrder();
}

/** Picks a section up by its grip, to follow the pointer until it's let go. */
function startDrag(section: HTMLElement, grip: HTMLElement, down: PointerEvent): void {
  const drag: SectionDrag = {
    section,
    restingPointerY: down.clientY,
    offsetY: 0,
    slideTransition: isMotionReduced() ? "none" : `translate ${TIMING.slide}ms ${SLIDE_EASING}`,
  };
  // A drag that starts before the section has settled from the last one
  // stops that settling: it would let go of the section mid-drag.
  clearTimeout(settleTimers.get(section));
  section.classList.add(PAGE_CLASSES.dragging);
  section.style.transition = "none";
  // The grip keeps the pointer as the sections move under it.
  followPointer(
    grip,
    down,
    (move) => dragTo(drag, move.clientY),
    () => drop(drag),
  );
}

/** Gives a section a six-dot grip, to drag it into another order; the
    arrow keys on it move it too. */
function addGrip(section: HTMLElement): void {
  const sectionName = section.querySelector(SELECTOR.panelHeading)?.textContent ?? "";
  const label = words.moveSection.replace("{name}", sectionName);
  const grip = make("button", {
    type: "button",
    class: `${PAGE_CLASSES.grip} ic i-grip`,
    "aria-label": label,
    title: label,
  });
  section.append(grip);
  grip.addEventListener("keydown", (event) => {
    const above = sectionAbove(section);
    const below = sectionBelow(section);
    if (event.key === "ArrowUp" && above) above.before(section);
    else if (event.key === "ArrowDown" && below) below.after(section);
    else return;
    event.preventDefault();
    // Moving the section in the page takes focus off its grip.
    grip.focus();
    rememberSectionOrder();
  });
  grip.addEventListener("pointerdown", (event) => {
    const isMainButton = event.button === 0;
    if (!isMainButton) return;
    event.preventDefault();
    startDrag(section, grip, event);
  });
}

/** Folding sections, in the order this browser left them, with grips. */
export function initPanel(): void {
  findAll(detailsPanel, SELECTOR.panelHeading).forEach(foldable);
  restoreSectionOrder();
  panelSections().forEach(addGrip);
}
