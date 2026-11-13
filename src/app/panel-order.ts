/* The order the details panel's sections are shown in, from the order this
   browser left them in. It needs no page. */
import { isArrayOf, isString } from "../contracts/guards.ts";

/** The sections' heading ids in the order to show them. Those the browser
    doesn't remember (added to the site since) come first, as the page has
    them; then the ones it does, as they were left. What's remembered may
    be an older version's or edited by hand: a list that isn't all ids is
    no order at all, an id the page doesn't have is passed over, and of an
    id listed twice the later place counts. */
export function sectionOrder(headingIdsInPage: readonly string[], remembered: unknown): string[] {
  const rememberedIds = isArrayOf(remembered, isString) ? remembered : [];
  const asLeft = rememberedIds.filter(
    (id, place) => headingIdsInPage.includes(id) && rememberedIds.lastIndexOf(id) === place,
  );
  const newToThisBrowser = headingIdsInPage.filter((id) => !asLeft.includes(id));
  return [...newToThisBrowser, ...asLeft];
}
