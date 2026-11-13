/* The personal answers: the only ones that aren't in a thread (they're in
   the question card's data). Each gets a tab of its own, made from a copy
   of the "Something else" tab. */
import { ID_PREFIX, personalTab } from "../contracts/page-ids.ts";
import { type PersonalAnswer } from "../config/question-card.ts";
import { SELECTOR } from "./constants.ts";
import { clone, find } from "./lib/dom.ts";
import { renderBlock } from "./lib/markdown.ts";
import { askedTab, questionCard } from "./page.ts";
import { copyTab } from "./tabs.ts";

// "Something else" as the page has it, before the script changes it: taken
// as this file loads, which is before main.ts wires anything.
const tabPattern = clone(askedTab);

/** Whether a tab's id is a personal answer's. */
export const isPersonalTab = (tabId: string): boolean => tabId.startsWith(ID_PREFIX.personal);

/** A tab for one personal answer: its question, then its paragraphs and
    lists in place of the pattern's answer, above the buttons the pattern's
    answer ends with. */
function makePersonalTab(personal: PersonalAnswer): HTMLElement {
  const tab = copyTab(tabPattern, personalTab(personal.id));
  find(tab, SELECTOR.title).textContent = personal.title ?? personal.q;
  find(tab, SELECTOR.askedQuestion).textContent = personal.q;
  const answer = find(tab, SELECTOR.answer);
  const actions = answer.querySelector(SELECTOR.messageActions);
  answer.replaceChildren(...personal.a.map(renderBlock), ...(actions ? [actions] : []));
  return tab;
}

/** Adds a tab for each personal answer, after "Something else". */
export function addPersonalTabs(): void {
  let lastTab: Element = askedTab;
  for (const personal of questionCard.personal) {
    const tab = makePersonalTab(personal);
    lastTab.after(tab);
    lastTab = tab;
  }
}
