/* Dragging a section of the details panel by its grip. The dragged section
   follows the pointer; when its middle passes a neighbour's, the neighbour
   slides into the gap it leaves. Only the neighbours move in the page, so
   the dragged section keeps the pointer. */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { TIMING } from "./constants.ts";
import { followPointer } from "./lib/drag.ts";
import { isMotionReduced } from "./lib/motion.ts";

const SLIDE_MS = 180;
/** Fast, then gently to rest. */
const SLIDE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

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

/** Picks a section up by its grip, to follow the pointer until it's let
    go; `onDrop` runs once it is, with the sections in their new order. */
export function startDrag(section: HTMLElement, grip: HTMLElement, down: PointerEvent, onDrop: () => void): void {
  const drag: SectionDrag = {
    section,
    restingPointerY: down.clientY,
    offsetY: 0,
    slideTransition: isMotionReduced() ? "none" : `translate ${SLIDE_MS}ms ${SLIDE_EASING}`,
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
    () => {
      drop(drag);
      onDrop();
    },
  );
}

/** The section just above this one, if there is one. (Above the panel's
    first section is its close button, which isn't one.) */
export const sectionAbove = (section: HTMLElement): HTMLElement | null =>
  section.previousElementSibling instanceof HTMLElement && section.previousElementSibling.matches("section")
    ? section.previousElementSibling
    : null;

/** The section just below this one, if there is one: the sections are the
    last things in the panel. */
export const sectionBelow = (section: HTMLElement): HTMLElement | null =>
  section.nextElementSibling instanceof HTMLElement ? section.nextElementSibling : null;

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

/** `reorder` moves the dragged section and a neighbour it has passed, one
    past the other, in the page. The page then has the dragged section
    somewhere new, so what it's shown moved by, and where the pointer
    rests, change by as much: it stays under the pointer. The neighbour
    slides from where it was into the gap. */
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

/** The dragged section slides into the place the page now has it, and is
    put down once it's there. */
function drop(drag: SectionDrag): void {
  const { section } = drag;
  section.style.transition = drag.slideTransition;
  section.style.translate = "0 0";
  settleLater(section, () => section.classList.remove(PAGE_CLASSES.dragging));
}

/** Once a section has had time to slide into place, takes away what the
    drag put on it, then runs `onSettled`. */
function settleLater(section: HTMLElement, onSettled?: () => void): void {
  const timer = setTimeout(() => {
    section.style.transition = "";
    section.style.translate = "";
    onSettled?.();
  }, TIMING.settle);
  settleTimers.set(section, timer);
}

/** Shows a section `offsetY` pixels down from where the page has it. */
function showOffset(section: HTMLElement, offsetY: number): void {
  section.style.translate = `0 ${offsetY}px`;
}

/** How far down the panel a section's middle is, as the page has it. */
const middleOf = (section: HTMLElement): number => section.offsetTop + section.offsetHeight / 2;
