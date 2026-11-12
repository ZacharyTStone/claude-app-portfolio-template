/* A flow that follows an example through its steps (content.ts's Flow).
   The page has all of it, every step with what the example looks like
   there (Flow.astro), and shows all of it without this. Here it plays: the
   steps light up in turn, each showing its example as the one before
   finishes, once the figure scrolls into view. A step can be picked to see
   its own, and a button plays it again.

   Nothing is hidden from a screen reader at any point (a step not reached
   yet is only faint), and with motion reduced it doesn't play by itself. */
import { CLASS, SELECTOR, SIZE, TIMING } from "./constants.ts";
import { findAll, make, query } from "./lib/dom.ts";
import { reducedMotion } from "./lib/motion.ts";
import { root, words } from "./page.ts";

/** The timer of each flow that's playing itself: when its next step shows. */
const nextStepTimers = new WeakMap<HTMLElement, number>();

/** What tells us the visitor is scrolling by hand: from then on, a flow
    that's playing leaves the scroll to them. */
const SCROLLED_BY_HAND = ["wheel", "touchmove"] as const;

const stepsOf = (flow: HTMLElement): HTMLElement[] => findAll(flow, SELECTOR.flowSteps);

/** Shows the example at one step: the steps before it are passed, it's the
    current one, and the steps after it wait. An `index` before the first
    step (-1) shows none yet: the flow is ready to play. */
function showStep(flow: HTMLElement, index: number): void {
  flow.classList.add(CLASS.flowStepping);
  stepsOf(flow).forEach((step, i) => {
    step.classList.toggle(CLASS.flowPassed, i < index);
    step.classList.toggle(CLASS.flowCurrent, i === index);
    const name = query(step, SELECTOR.flowStep);
    if (i === index) name?.setAttribute("aria-current", "step");
    else name?.removeAttribute("aria-current");
  });
}

/** Stops a flow playing itself, where it is. */
function stopPlaying(flow: HTMLElement): void {
  clearTimeout(nextStepTimers.get(flow));
  nextStepTimers.delete(flow);
  flow.classList.remove(CLASS.flowPlaying);
}

/** Brings a step into view if it isn't, by as little as it takes: a flow
    taller than a phone's screen is followed down as it plays. */
function keepInView(step: HTMLElement): void {
  step.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
}

/** Plays a flow from its first step to its last, one step every
    TIMING.flowStep, and leaves it on the last. The step it's at is kept in
    view, until the visitor scrolls by hand. */
function play(flow: HTMLElement): void {
  stopPlaying(flow);
  const steps = stepsOf(flow);
  const last = steps.length - 1;
  const playButton = query(flow, SELECTOR.flowPlay);
  if (playButton) playButton.textContent = words.flowReplay;
  flow.classList.add(CLASS.flowPlaying);
  let following = true;
  const stopFollowing = () => (following = false);
  for (const sign of SCROLLED_BY_HAND) addEventListener(sign, stopFollowing, { once: true, passive: true });
  const showFrom = (index: number): void => {
    showStep(flow, index);
    const step = steps[index];
    if (following && step) keepInView(step);
    if (index >= last) return stopPlaying(flow);
    nextStepTimers.set(
      flow,
      setTimeout(() => showFrom(index + 1), TIMING.flowStep),
    );
  };
  showFrom(0);
}

/** A flow back to how the page has it, every step showing: for a copy of
    one, which has no timer of its own (a chat copies the answer it's in). */
export function resetFlow(flow: HTMLElement): void {
  stopPlaying(flow);
  flow.classList.remove(CLASS.flowStepping);
  for (const step of stepsOf(flow)) {
    step.classList.remove(CLASS.flowPassed, CLASS.flowCurrent);
    query(step, SELECTOR.flowStep)?.removeAttribute("aria-current");
  }
  const playButton = query(flow, SELECTOR.flowPlay);
  if (playButton) playButton.textContent = words.flowPlay;
}

/** Every flow that follows an example in `parent`, itself included. */
export const flowsIn = (parent: Element): HTMLElement[] => [
  ...(parent instanceof HTMLElement && parent.matches(SELECTOR.flowExample) ? [parent] : []),
  ...findAll(parent, SELECTOR.flowExample),
];

/** The step a click or a key press was on, with its flow and its place in
    it, if it was on one. */
function pickedStep(target: EventTarget | null): { flow: HTMLElement; index: number } | null {
  const name = target instanceof Element ? target.closest(SELECTOR.flowStep) : null;
  const flow = name?.closest(SELECTOR.flowExample);
  if (!name || !(flow instanceof HTMLElement)) return null;
  const index = stepsOf(flow).findIndex((step) => step.contains(name));
  return index < 0 ? null : { flow, index };
}

/** A play button, and steps that can be picked: what a flow needs to be
    played by hand. A picked step is focusable and says it's a button. */
function addControls(flow: HTMLElement): void {
  const playButton = make("button", { type: "button", class: `btn-ghost ${CLASS.flowPlay}` }, words.flowPlay);
  query(flow, "figcaption")?.append(playButton);
  for (const name of findAll(flow, SELECTOR.flowStep)) {
    name.setAttribute("role", "button");
    name.setAttribute("tabindex", "0");
  }
}

/** Plays each flow once, when enough of it has scrolled into view. Until
    then it waits with no step showing. */
function playWhenSeen(flows: HTMLElement[]): void {
  const seen = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting || !(target instanceof HTMLElement)) continue;
        seen.unobserve(target);
        play(target);
      }
    },
    { threshold: SIZE.flowInView },
  );
  for (const flow of flows) {
    showStep(flow, -1);
    seen.observe(flow);
  }
}

/** Makes the page's example flows playable, and plays each as it's first
    seen (not with motion reduced: then it shows whole until it's played by
    hand). The clicks are listened for on the document, so the copies of an
    answer that chats make work too. */
export function initFlows(): void {
  const flows = findAll(document, SELECTOR.flowExample);
  if (!flows.length) return;
  // How long the line between two steps takes to fill, for the stylesheet:
  // on <html>, as an element that's copied can't carry a style of its own
  // (the page's security policy refuses the copy's).
  root.style.setProperty("--flow-step", `${TIMING.flowStep}ms`);
  flows.forEach(addControls);
  if (!reducedMotion()) playWhenSeen(flows);

  document.addEventListener("click", (event) => {
    const playButton = event.target instanceof Element ? event.target.closest(SELECTOR.flowPlay) : null;
    const flow = playButton?.closest(SELECTOR.flowExample);
    if (flow instanceof HTMLElement) return play(flow);
    const picked = pickedStep(event.target);
    if (!picked) return;
    stopPlaying(picked.flow);
    showStep(picked.flow, picked.index);
  });
  // A step is a button by its role, so Enter and Space press it.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const picked = pickedStep(event.target);
    if (!picked) return;
    event.preventDefault();
    stopPlaying(picked.flow);
    showStep(picked.flow, picked.index);
  });
}
