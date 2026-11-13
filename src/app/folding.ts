/* Folding the sidebar's groups and the panel's sections. The heading's
   words go in a button, so a click anywhere on the heading, its triangle
   included, folds what's under it. Remembered per browser. */
import { isArrayOf, isString } from "../contracts/guards.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { make } from "./lib/dom.ts";
import { local } from "./lib/storage.ts";

/** localStorage: the ids of the headings left folded. */
const FOLDED_KEY = "portfolio:folded";

/** A heading that folds what's under it. */
type Fold = {
  heading: HTMLElement;
  /** The button made around the heading's words. */
  button: HTMLElement;
  /** What the heading folds: the element after it. */
  body: HTMLElement;
};

function readFoldedIds(): Set<string> {
  const saved = local.getJson(FOLDED_KEY);
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
  heading.classList.toggle(PAGE_CLASSES.folded, !isOpen);
}

/** Opens or folds a fold, and remembers which for the next visit. */
function setFold(fold: Fold, isOpen: boolean): void {
  showFold(fold, isOpen);
  if (isOpen) foldedIds.delete(fold.heading.id);
  else foldedIds.add(fold.heading.id);
  local.setJson(FOLDED_KEY, [...foldedIds]);
}

/** Makes a heading fold the element after it. */
export function foldable(heading: HTMLElement): void {
  const body = heading.nextElementSibling;
  if (!(body instanceof HTMLElement)) return;
  const button = make("button", { type: "button", class: PAGE_CLASSES.foldButton }, ...heading.childNodes);
  heading.append(button);
  heading.classList.add(PAGE_CLASSES.foldable);
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
  button.addEventListener("click", () => setFold(fold, isFolded(fold)));
}

/** Unfolds what a heading folded (opening a tab that's in it does). */
export function unfold(body: Element): void {
  const fold = foldsByBody.get(body);
  if (fold) setFold(fold, true);
}
