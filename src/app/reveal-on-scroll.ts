/* A quote or a file card that's out of sight when the page starts waits,
   hidden without moving anything, and comes in once when it's scrolled to
   (src/styles/motion.css). Without the script, or with motion reduced,
   the page shows them whole. */
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

const EVERY_CLASS_ADDED_HERE = [PAGE_CLASSES.waiting, PAGE_CLASSES.seen, ...LATER] as const;

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

/** A copy of something in the page is shown as it is: nothing watches for
    it to be scrolled to. */
export function showWhole(copy: Element): void {
  for (const element of [copy, ...copy.querySelectorAll(PART_SELECTOR.comesIntoView)])
    element.classList.remove(...EVERY_CLASS_ADDED_HERE);
}

/** One in a tab that isn't open has no size, and isn't on screen. */
function isOnScreen(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.height > 0 && box.bottom > 0 && box.top < innerHeight;
}

/** In turn, when several have come into view together. */
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

function isFarEnoughIn(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false;
  const screenHeight = entry.rootBounds?.height ?? innerHeight;
  const showsEnoughOfItself = entry.intersectionRatio >= SHARE_IN_VIEW;
  const fillsEnoughOfTheScreen = entry.intersectionRect.height >= screenHeight * SHARE_OF_SCREEN_FILLED;
  return showsEnoughOfItself || fillsEnoughOfTheScreen;
}
