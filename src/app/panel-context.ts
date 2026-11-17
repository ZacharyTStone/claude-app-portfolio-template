/* The panel's Context, on a site that gathers it from the answers
   (src/site/context-links.ts): the page has a list for each tab that links
   anywhere, and shows the open tab's above the config's own rows. A chat
   has a list the script makes from those: the rows of the tabs its answers
   are from, copied. The home screen, "Something else" and a chat with no
   answer from such a tab show the config's rows alone. */
import { DATA } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { ATTRIBUTE_SELECTOR } from "../contracts/page-selectors.ts";
import { clone, findAll, make } from "./lib/dom.ts";
import { onceEach } from "./lib/lists.ts";
import { detailsPanel } from "./page.ts";

/** The open tab's id, or null for the home screen: whose list shows. */
let shownFor: string | null = null;

const gatheredLists = (): HTMLElement[] => findAll(detailsPanel, ATTRIBUTE_SELECTOR.contextOf);

const listOf = (tabId: string): HTMLElement | undefined =>
  gatheredLists().find((list) => list.getAttribute(DATA.contextOf) === tabId);

/** Shows the list of the tab that's open (its id), or none for the home
    screen (null), and hides the rest. A tab without links of its own shows
    none: only the config's rows. */
export function showContextOf(openTab: string | null): void {
  shownFor = openTab;
  for (const list of gatheredLists()) list.hidden = list.getAttribute(DATA.contextOf) !== openTab;
}

/** Where a row links, as the browser reads it: the same address however
    it's written. */
const addressOf = (row: Element): string => row.querySelector("a")?.href ?? row.textContent;

/** A chat's list, made again: each row of the lists of the tabs its answers
    are from (`fromTabs`, in the order the chat comes to them), copied as
    the page has it, each address once, where it first comes. A chat with
    none to list has no list. */
export function listContextOf(chatTabId: string, fromTabs: string[]): void {
  listOf(chatTabId)?.remove();
  const builtRows = fromTabs.flatMap((tabId) => {
    const list = listOf(tabId);
    return list ? findAll(list, ":scope > li") : [];
  });
  const rows = onceEach(builtRows, addressOf).map(clone);
  const lastList = gatheredLists().at(-1);
  if (!rows.length || !lastList) return;
  const attributes = { class: PAGE_CLASSES.panelRows, [DATA.contextOf]: chatTabId };
  const list = make("ul", { ...attributes, hidden: chatTabId === shownFor ? null : "" }, ...rows);
  lastList.after(list);
}
