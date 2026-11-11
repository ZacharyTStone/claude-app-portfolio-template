/* Motion, unless the visitor's system asks for less. */

const reduce = matchMedia("(prefers-reduced-motion: reduce)");

export const reducedMotion = (): boolean => reduce.matches;

/** For scrollTo: smooth, unless motion is reduced. */
const scrollBehavior = (): ScrollBehavior => (reduce.matches ? "auto" : "smooth");

/** Scrolls `scroller` to bring `el` to its top, `margin` under the edge, or
    as near to it as there's room to scroll. Says whether there was room. */
export function scrollToTop(scroller: HTMLElement, el: Element, margin: number): boolean {
  const top = scroller.scrollTop + el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - margin;
  scroller.scrollTo({ top, behavior: scrollBehavior() });
  return top <= scroller.scrollHeight - scroller.clientHeight;
}

/** Waits `ms`, or no time at all when motion is reduced. */
export const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, reduce.matches ? 0 : ms));
