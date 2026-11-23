/* The open tab's highlight in the sidebar glides from the row that had it
   to the new one instead of jumping: the new row's highlight is drawn over
   the old row first, then let go, and slides into place
   (src/components/Sidebar.css draws it, src/styles/motion.css moves it).
   With motion reduced, or a row that isn't showing, it's simply there. */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { isMotionReduced } from "./lib/motion.ts";

/** How far above and below its row the highlight starts, as the stylesheet
    reads it. */
const STARTS_ABOVE = "--glide-top";
const STARTS_BELOW = "--glide-bottom";

/** Where the highlight is now: the row that has it, if it's showing. */
export function highlightOf(row: Element | null): DOMRect | null {
  const box = row?.getBoundingClientRect();
  return box?.height ? box : null;
}

/** `row` has just been marked: its highlight slides into it from `from`. */
export function glideInto(row: Element | null, from: DOMRect | null): void {
  if (!(row instanceof HTMLElement) || !from || isMotionReduced()) return;
  const to = row.getBoundingClientRect();
  if (!to.height || to.top === from.top) return;
  // Put over the old row at once, drawn there for a frame, then let go.
  row.classList.add(PAGE_CLASSES.glidesIn);
  row.style.setProperty(STARTS_ABOVE, `${from.top - to.top}px`);
  row.style.setProperty(STARTS_BELOW, `${to.bottom - from.bottom}px`);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      row.classList.remove(PAGE_CLASSES.glidesIn);
      row.style.removeProperty(STARTS_ABOVE);
      row.style.removeProperty(STARTS_BELOW);
    }),
  );
}
