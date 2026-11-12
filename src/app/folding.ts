/* Folding the sidebar's groups and the panel's sections. The heading's
   words go in a button, so a click anywhere on the heading, its triangle
   included, folds what's under it. Remembered per browser. */
import { isArrayOf, isString } from "../shared/guards.ts";
import { CLASS, STORAGE } from "./constants.ts";
import { make } from "./lib/dom.ts";
import { local } from "./lib/storage.ts";

/** A heading that folds what's under it. */
type Fold = {
  heading: HTMLElement;
  /** The button made around the heading's words. */
  button: HTMLElement;
  /** What the heading folds: the element after it. */
  body: HTMLElement;
};

/** The ids of the headings this browser left folded. */
function readFoldedIds(): Set<string> {
  const saved = local.getJson(STORAGE.folded);
  return new Set(isArrayOf(saved, isString) ? saved : []);
}

const foldedIds = readFoldedIds();
/** Each fold, by what it folds: for unfold(), which is given only that. */
const foldsByBody = new WeakMap<Element, Fold>();

const isFolded = ({ body }: Fold): boolean => Boolean(body.hidden);

/** Shows a fold open or folded, to the eye and to screen readers. */
function showFold({ heading, button, body }: Fold, isOpen: boolean): void {
  body.hidden = !isOpen;
  button.setAttribute("aria-expanded", String(isOpen));
  heading.classList.toggle(CLASS.folded, !isOpen);
}

/** Opens or folds a fold, and remembers which for the next visit. */
function setFold(fold: Fold, isOpen: boolean): void {
  showFold(fold, isOpen);
  if (isOpen) foldedIds.delete(fold.heading.id);
  else foldedIds.add(fold.heading.id);
  local.setJson(STORAGE.folded, [...foldedIds]);
}

/** Makes a heading fold the element after it. */
export function foldable(heading: HTMLElement): void {
  const body = heading.nextElementSibling;
  if (!(body instanceof HTMLElement)) return;
  const button = make("button", { type: "button", class: CLASS.foldButton }, ...heading.childNodes);
  heading.append(button);
  heading.classList.add(CLASS.foldable);
  // A click on the heading beside its words (on its triangle, say) counts
  // as one on the button.
  heading.addEventListener("click", (event) => {
    if (event.target === heading) button.click();
  });
  body.id ||= `${heading.id}-list`;
  button.setAttribute("aria-controls", body.id);

  const fold: Fold = { heading, button, body };
  foldsByBody.set(body, fold);
  showFold(fold, !foldedIds.has(heading.id));
  // A click opens it if it's folded, and folds it if it's open.
  button.addEventListener("click", () => setFold(fold, isFolded(fold)));
}

/** Unfolds what a heading folded (opening a tab that's in it does). */
export function unfold(body: Element): void {
  const fold = foldsByBody.get(body);
  if (fold) setFold(fold, true);
}
