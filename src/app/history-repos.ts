/* A repo's name under a row of the GitHub history's calendar and its dot
   in the row light up together: pointing at or focusing either lights
   both, so that a name shows the week it was made, and a dot its name. */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { closestFrom, findAll } from "./lib/dom.ts";

/** Lights a repo's two links as either is pointed at or focused, and puts
    them out as it's left. */
export function initHistoryRepos(): void {
  for (const type of ["pointerover", "focusin"]) document.addEventListener(type, (event) => light(event, true));
  for (const type of ["pointerout", "focusout"]) document.addEventListener(type, (event) => light(event, false));
}

function light({ target }: Event, isLit: boolean): void {
  const link = closestFrom(target, PART_SELECTOR.historyRepoLink);
  const calendar = link?.closest(CLASS_SELECTOR.historyCalendar);
  if (!link || !calendar) return;
  const address = link.getAttribute("href");
  for (const each of findAll(calendar, PART_SELECTOR.historyRepoLink)) {
    if (each.getAttribute("href") === address) each.classList.toggle(PAGE_CLASSES.lit, isLit);
  }
}
