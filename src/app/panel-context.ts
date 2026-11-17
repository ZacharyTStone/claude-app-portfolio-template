/* The panel's Context, on a site that gathers it from the answers
   (src/site/context-links.ts): the page has a list for each tab that links
   anywhere, and the home screen's, and shows the one for the open tab
   above the config's own rows. */
import { contextListFor, DATA } from "../contracts/page-attributes.ts";
import { ATTRIBUTE_SELECTOR } from "../contracts/page-selectors.ts";
import { findAll } from "./lib/dom.ts";
import { detailsPanel } from "./page.ts";

/** Shows the list of the tab with a page that's open (its id), or the home
    screen's (null), and hides the rest. A tab without links of its own
    shows none: only the config's rows. */
export function showContextOf(tabWithAPage: string | null): void {
  const shown = contextListFor(tabWithAPage);
  for (const list of findAll(detailsPanel, ATTRIBUTE_SELECTOR.contextOf)) {
    list.hidden = list.getAttribute(DATA.contextOf) !== shown;
  }
}
