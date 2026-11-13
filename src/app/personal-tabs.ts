/* The personal answers: the only ones that aren't in a thread (they're in
   the question card's data). Each gets a tab of its own, made from a copy
   of the "Something else" tab. */
import { ID_PREFIX, personalTabId } from "../contracts/page-ids.ts";
import type { PersonalAnswer } from "../config/question-card.ts";
import { CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { find } from "./lib/dom.ts";
import { renderBlock } from "./lib/markdown.ts";
import { askedTab } from "./page.ts";
import { questionCard } from "./question-card/data.ts";
import { copyTab } from "./tabs.ts";

export const isPersonalTab = (tabId: string): boolean => tabId.startsWith(ID_PREFIX.personal);

/** A tab for one personal answer: its question, then its paragraphs and
    lists in place of the pattern's answer, above the buttons the pattern's
    answer ends with. */
function makePersonalTab(tabPattern: HTMLElement, personal: PersonalAnswer): HTMLElement {
  const tab = copyTab(tabPattern, personalTabId(personal.id));
  find(tab, CLASS_SELECTOR.title).textContent = personal.title ?? personal.q;
  find(tab, CLASS_SELECTOR.askedQuestion).textContent = personal.q;
  const answer = find(tab, CLASS_SELECTOR.answer);
  const actions = answer.querySelector(CLASS_SELECTOR.messageActions);
  answer.replaceChildren(...personal.a.map(renderBlock), ...(actions ? [actions] : []));
  return tab;
}

/** Adds a tab for each personal answer, after "Something else": each is a
    copy of `tabPattern`, "Something else" as the page was built. */
export function addPersonalTabs(tabPattern: HTMLElement): void {
  let lastTab: Element = askedTab;
  for (const personal of questionCard.personal) {
    const tab = makePersonalTab(tabPattern, personal);
    lastTab.after(tab);
    lastTab = tab;
  }
}
