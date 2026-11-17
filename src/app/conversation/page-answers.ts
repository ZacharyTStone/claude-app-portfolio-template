/* The page's own questions and answers, read from its threads and copied
   for a reply. What's been sent into a thread isn't the page's own, and is
   never part of a copy. */
import { parseAnswerId, threadAnswerId, type AskTurn } from "../../contracts/ask.ts";
import { CLASS_SELECTOR, PART_SELECTOR } from "../../contracts/page-selectors.ts";
import { clone, find } from "../lib/dom.ts";
import { restStill } from "../play.ts";
import { showWhole } from "../reveal-on-scroll.ts";

const OWN_QUESTION = `${PART_SELECTOR.threadQuestion}:not(${CLASS_SELECTOR.sent})`;

/** A question's words, without the "Question:" said only to screen readers. */
export function questionText(question: Element): string {
  return [...question.childNodes]
    .filter((node) => !(node instanceof Element && node.matches(CLASS_SELECTOR.srOnly)))
    .map((node) => node.textContent)
    .join("")
    .trim();
}

function tabWithId(tabId: string): HTMLElement | null {
  const tab = document.getElementById(tabId);
  return tab?.matches(CLASS_SELECTOR.tab) ? tab : null;
}

/** The first question of a tab's thread, if the page has the tab. */
export function firstQuestionOf(tabId: string): string | null {
  const question = document.getElementById(tabId)?.querySelector(PART_SELECTOR.threadQuestion);
  return question ? questionText(question) : null;
}

/** One of the page's answers: the tab it's in, and its question there. */
export type PageAnswer = { tab: HTMLElement; question: Element };

/** The answer an id names ("work.2": the second in Work), if the page has it. */
export function findAnswer(answerId: string): PageAnswer | null {
  const place = parseAnswerId(answerId);
  const tab = place ? tabWithId(place.tabId) : null;
  const question = place && tab?.querySelectorAll(OWN_QUESTION)[place.answerNumber - 1];
  return tab && question ? { tab, question } : null;
}

export const isOnPage = (answerId: string): boolean => findAnswer(answerId) !== null;

// The last of the questions the visitor has read down to: the last one
// above the middle of what the tab shows, or, with the tab scrolled to its
// end (or too short to scroll), the last of all.
function lastRead(scroller: Element, questions: Element[]): number {
  const isAtEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
  if (isAtEnd) return questions.length - 1;
  const { top, height } = scroller.getBoundingClientRect();
  const middle = top + height / 2;
  return questions.findLastIndex((question) => question.getBoundingClientRect().top <= middle);
}

/** The tab's own answers, down to the one being read, or the first. Each
    is a turn of the tab, for a question asked in it (follow-up.ts). */
export function answersReadIn(tab: HTMLElement): AskTurn[] {
  const questions = [...tab.querySelectorAll(OWN_QUESTION)];
  const readTo = lastRead(find(tab, CLASS_SELECTOR.scroll), questions);
  return questions
    .slice(0, Math.max(readTo, 0) + 1)
    .map((question, i) => ({ question: questionText(question), id: threadAnswerId(tab.id, i + 1) }));
}

/** A message to show again elsewhere: without its buttons or the ids the
    page already has, with nothing in it waiting to be scrolled to, and no
    picture in it playing. */
function copyMessage(message: Element): Element {
  const copy = clone(message);
  copy.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  showWhole(copy);
  restStill(copy);
  return copy;
}

/** Everything the page has between an answer's question and the next. */
export function copyOfAnswer({ question }: PageAnswer): Element[] {
  const messages: Element[] = [];
  let message = question.nextElementSibling;
  while (message && !message.matches(CLASS_SELECTOR.question)) {
    if (!message.matches(CLASS_SELECTOR.sent)) messages.push(copyMessage(message));
    message = message.nextElementSibling;
  }
  return messages;
}

/** A thread's answers as one reply to its first question: its later
    questions aren't sent as if the visitor had asked them, and what
    follows its first answer goes into that answer. */
export function copyOfThread(tab: HTMLElement): Element[] {
  const afterFirstQuestion = [...find(tab, CLASS_SELECTOR.thread).children].slice(1);
  const copies = afterFirstQuestion
    .filter((message) => !message.matches(`${CLASS_SELECTOR.question}, ${CLASS_SELECTOR.sent}`))
    .map(copyMessage);
  const firstAnswerAt = copies.findIndex((copy) => copy.matches(CLASS_SELECTOR.answer));
  const [firstAnswer, ...later] = firstAnswerAt === -1 ? [] : copies.slice(firstAnswerAt);
  if (!firstAnswer) return copies;
  for (const copy of later) firstAnswer.append(...(copy.matches(CLASS_SELECTOR.answer) ? copy.childNodes : [copy]));
  return [...copies.slice(0, firstAnswerAt), firstAnswer];
}
