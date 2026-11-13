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
import { findAll } from "./lib/dom.ts";
import { isMotionReduced } from "./lib/motion.ts";

/** How much of a quote or a card has to be on screen before it comes in, as
    a share of it; or else, for one too tall to show that much of, how much
    of the screen it has to fill. */
const SHARE_IN_VIEW = 0.3;
const SHARE_OF_SCREEN_FILLED = 0.4;

/** How long after a page starts to load it's still arriving. */
const PAGE_ARRIVES_MS = 700;

/** How far behind the first each one is, when several come into view
    together: the second, the third, and every one after. */
const LATER = [PAGE_CLASSES.seenAfter1, PAGE_CLASSES.seenAfter2, PAGE_CLASSES.seenAfter3] as const;

/** Every class this file puts on an element. */
const MARKS = [PAGE_CLASSES.waiting, PAGE_CLASSES.seen, ...LATER] as const;

/** Makes what's out of sight wait, and brings each in when it's scrolled to. */
export function initRevealOnScroll(): void {
  if (isMotionReduced() || !("IntersectionObserver" in window)) return;
  const watcher = new IntersectionObserver(bringIn, { threshold: [0, SHARE_IN_VIEW] });
  // A page that has only just opened is still arriving, so what's on screen
  // can come in with the rest. Later than that it's being read, and hiding
  // it for a moment to bring it in would be a blink.
  const isPageBeingRead = performance.now() > PAGE_ARRIVES_MS;
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
  const showsEnoughOfItself = entry.intersectionRatio >= SHARE_IN_VIEW;
  const fillsEnoughOfTheScreen = entry.intersectionRect.height >= screenHeight * SHARE_OF_SCREEN_FILLED;
  return showsEnoughOfItself || fillsEnoughOfTheScreen;
}
