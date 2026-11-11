/* Folding the sidebar's groups and the panel's sections. The heading's
   words go in a button, so a click anywhere on the heading, its triangle
   included, folds what's under it. Remembered per browser. */
import { isArrayOf, isString } from "../shared/guards.ts";
import { CLASS, STORAGE } from "./constants.ts";
import { make } from "./lib/dom.ts";
import { local } from "./lib/storage.ts";

// The ids of the folded headings.
const saved = local.getJson(STORAGE.folded);
const folded = new Set(isArrayOf(saved, isString) ? saved : []);
const unfolders = new WeakMap<Element, () => void>();

/** Makes a heading fold the element after it. */
export function foldable(heading: HTMLElement): void {
  const body = heading.nextElementSibling;
  if (!(body instanceof HTMLElement)) return;
  const button = make("button", { type: "button", class: CLASS.foldButton }, ...heading.childNodes);
  heading.append(button);
  heading.classList.add(CLASS.foldable);
  heading.addEventListener("click", (event) => {
    if (event.target === heading) button.click();
  });
  body.id ||= `${heading.id}-list`;
  button.setAttribute("aria-controls", body.id);

  const set = (open: boolean, remember: boolean) => {
    body.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    heading.classList.toggle(CLASS.folded, !open);
    if (!remember) return;
    if (open) folded.delete(heading.id);
    else folded.add(heading.id);
    local.setJson(STORAGE.folded, [...folded]);
  };
  set(!folded.has(heading.id), false);
  button.addEventListener("click", () => set(Boolean(body.hidden), true));
  unfolders.set(body, () => set(true, true));
}

/** Unfolds what a heading folded (opening a tab that's in it does). */
export function unfold(body: Element): void {
  unfolders.get(body)?.();
}
