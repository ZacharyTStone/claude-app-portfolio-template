/* Motion, unless the visitor's system asks for less. */
import { REDUCED_MOTION } from "../../shared/page-data.ts";

const reducedMotionQuery = matchMedia(REDUCED_MOTION);

/** Whether the visitor's system asks for less motion. */
export const isMotionReduced = (): boolean => reducedMotionQuery.matches;

/** How to scroll (for scrollTo and scrollIntoView): smoothly, or at once
    when motion is reduced. */
export const scrollBehavior = (): ScrollBehavior => (isMotionReduced() ? "auto" : "smooth");

/** Scrolls `scroller` to bring `element` to its top, `margin` under the
    edge, or as near to it as there's room to scroll. Says whether there was
    room. */
export function scrollToTop(scroller: HTMLElement, element: Element, margin: number): boolean {
  const scrollTopWanted =
    scroller.scrollTop + element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - margin;
  scroller.scrollTo({ top: scrollTopWanted, behavior: scrollBehavior() });
  const furthestScrollTop = scroller.scrollHeight - scroller.clientHeight;
  return scrollTopWanted <= furthestScrollTop;
}

/** Waits `ms`, or no time at all when motion is reduced. */
export const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, isMotionReduced() ? 0 : ms));
