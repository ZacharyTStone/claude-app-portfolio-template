/* The personal answers: the only ones that aren't in a thread (they're in
   the question card's data). Each gets a tab of its own, made from a copy
   of the "Something else" tab. */
import { ID_PREFIX, personalTab } from "../shared/page-data.ts";
import { SELECTOR } from "./constants.ts";
import { clone, find } from "./lib/dom.ts";
import { block } from "./lib/markdown.ts";
import { askedTab, questions } from "./page.ts";
import { copyTab } from "./tabs.ts";

// "Something else" as the page has it, before the script changes it.
const pattern = clone(askedTab);

export const isPersonalTab = (tabId: string): boolean => tabId.startsWith(ID_PREFIX.personal);

/** Adds a tab for each personal answer, after "Something else". */
export function addPersonalTabs(): void {
  let after: Element = askedTab;
  for (const item of questions.personal) {
    const tab = copyTab(pattern, personalTab(item.id));
    find(tab, SELECTOR.title).textContent = item.title ?? item.q;
    find(tab, SELECTOR.askedQuestion).textContent = item.q;
    const answer = find(tab, SELECTOR.answer);
    const actions = answer.querySelector(SELECTOR.messageActions);
    answer.replaceChildren(...item.a.map(block), ...(actions ? [actions] : []));
    after.after(tab);
    after = tab;
  }
}
