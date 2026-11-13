/* What comes in as it's scrolled to: a quote, and a file card, whose lines
   are then written out one after another (src/styles/motion.css has both).

   The page shows them whole without the script, and with motion reduced.
   With it, the ones out of sight when the page starts wait (PAGE_CLASSES.waiting,
   which hides them without moving anything) until they're on screen, then
   come in once (PAGE_CLASSES.seen). What's on screen is left alone once the page
   has been up long enough to be read, and a copy of an answer in a chat
   never waits: nothing watches it. */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { PART_SELECTOR } from "../contracts/page-selectors.ts";
import { SIZE, TIMING } from "./constants.ts";
import { findAll } from "./lib/dom.ts";
import { isMotionReduced } from "./lib/motion.ts";

/** How far behind the first each one is, when several come into view
    together: the second, the third, and every one after. */
const LATER = [PAGE_CLASSES.seenAfter1, PAGE_CLASSES.seenAfter2, PAGE_CLASSES.seenAfter3] as const;

/** Every class this file puts on an element. */
const MARKS = [PAGE_CLASSES.waiting, PAGE_CLASSES.seen, ...LATER] as const;

/** Makes what's out of sight wait, and brings each in when it's scrolled to. */
export function initSeen(): void {
  if (isMotionReduced() || !("IntersectionObserver" in window)) return;
  const watcher = new IntersectionObserver(bringIn, { threshold: [0, SIZE.inViewShare] });
  // A page that has only just opened is still arriving, so what's on screen
  // can come in with the rest. Later than that it's being read, and hiding
  // it for a moment to bring it in would be a blink.
  const isPageBeingRead = performance.now() > TIMING.pageArrives;
  for (const element of findAll(document, PART_SELECTOR.comesIntoView)) {
    if (isPageBeingRead && isOnScreen(element)) continue;
    element.classList.add(PAGE_CLASSES.waiting);
    watcher.observe(element);
  }
}

/** Takes the marks off a copy of something in the page, and everything in
    it: the copy is shown as it is, since nothing is watching for it. */
export function showWhole(copy: Element): void {
  for (const element of [copy, ...copy.querySelectorAll(PART_SELECTOR.comesIntoView)])
    element.classList.remove(...MARKS);
}

/** Whether any of an element is on screen now. One in a tab that isn't
    open has no size, and isn't. */
function isOnScreen(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.height > 0 && box.bottom > 0 && box.top < innerHeight;
}

/** Brings in each waiting element that has come far enough into view, in
    turn when several have. */
function bringIn(entries: IntersectionObserverEntry[], watcher: IntersectionObserver): void {
  const arrived = entries.filter(isFarEnoughIn).map((entry) => entry.target);
  arrived.forEach((element, place) => {
    watcher.unobserve(element);
    element.classList.remove(PAGE_CLASSES.waiting);
    element.classList.add(PAGE_CLASSES.seen);
    const later = place > 0 ? LATER[Math.min(place, LATER.length) - 1] : undefined;
    if (later) element.classList.add(later);
  });
}

/** Enough of it shows, or (for one taller than the screen) it fills enough
    of the screen. */
function isFarEnoughIn(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false;
  const screenHeight = entry.rootBounds?.height ?? innerHeight;
  return (
    entry.intersectionRatio >= SIZE.inViewShare || entry.intersectionRect.height >= screenHeight * SIZE.fillsScreenShare
  );
}
