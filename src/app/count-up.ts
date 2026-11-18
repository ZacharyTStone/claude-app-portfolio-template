/* A count in a part of the GitHub history climbs to its number as the part
   comes in: each number marked with DATA.count, over the number's own
   animation, which the stylesheet times (src/styles/motion.css), so that
   a year's total climbs as its row plays. Without the script, or with
   motion reduced, it's simply its number. */
import { DATA } from "../contracts/page-attributes.ts";
import { isMotionReduced } from "./lib/motion.ts";

/** Each number as the page wrote it, kept the first time it counts: it ends
    on that, in the page's own way of writing it, whatever it climbed in. */
const written = new WeakMap<Element, string>();

/** Fast at first, then settling on its number. */
const easedOut = (progress: number): number => 1 - (1 - progress) ** 3;

/** Counts each number up as its animation starts. */
export function initCountUp(): void {
  if (isMotionReduced()) return;
  document.addEventListener("animationstart", ({ target }) => {
    if (target instanceof HTMLElement && target.hasAttribute(DATA.count)) countUp(target);
  });
}

/** How long a number's animation takes, in ms: the first, if it has more. */
const animationMs = (element: Element): number => parseFloat(getComputedStyle(element).animationDuration) * 1000;

function countUp(element: HTMLElement): void {
  const to = Number(element.getAttribute(DATA.count));
  const takesMs = animationMs(element);
  if (!Number.isFinite(to) || !(takesMs > 0)) return;
  const asWritten = written.get(element) ?? element.textContent;
  written.set(element, asWritten);
  const format = new Intl.NumberFormat(document.documentElement.lang || undefined);
  const start = performance.now();
  const step = (now: number): void => {
    const progress = Math.min(1, (now - start) / takesMs);
    element.textContent = progress < 1 ? format.format(Math.round(to * easedOut(progress))) : asWritten;
    if (progress < 1) requestAnimationFrame(step);
  };
  step(start);
}
