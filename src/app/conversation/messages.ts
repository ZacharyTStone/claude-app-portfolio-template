/* An exchange as the messages a thread shows: the visitor's question in its
   bubble, then the reply. The one place that decides what either looks
   like, both when it's sent and when a chat is shown again. */
import { emailLink, withQuestion } from "../../contracts/links.ts";
import { DATA } from "../../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { clone, find, make } from "../lib/dom.ts";
import { rich } from "../lib/markdown.ts";
import { askedTab, words } from "../page.ts";
import { isPersonalTab } from "../personal-tabs.ts";
import {
  byOutcome,
  isRemoved,
  questionForOwner,
  type ByOutcome,
  type Exchange,
  type QuestionWith,
  type TypedQuestion,
} from "./exchange.ts";
import { copyOfAnswer, copyOfThread, findAnswer, firstQuestionOf } from "./page-answers.ts";

/** "Question: ", said before each question to screen readers, in the
    page's own words for it. */
const SAID_BEFORE_A_QUESTION =
  document.querySelector(`${CLASS_SELECTOR.question} ${CLASS_SELECTOR.srOnly}`)?.textContent ?? "";

/** What an exchange asks: the question typed in, or the chosen thread's
    first. Null for one that asks nothing: a thread the page hasn't. */
export function questionOf(exchange: Exchange): string | null {
  if (exchange.kind === "thread") return firstQuestionOf(exchange.tabId);
  return exchange.question || null;
}

/** Shows an exchange's question in its bubble. */
export function showQuestionIn(bubble: HTMLElement, exchange: Exchange): void {
  if (bubble.lastChild) bubble.lastChild.nodeValue = questionOf(exchange) ?? "";
  bubble.classList.toggle(PAGE_CLASSES.removed, isRemoved(exchange));
}

/** The visitor's message. */
export function questionBubble(exchange: Exchange): HTMLElement {
  const saidFirst = make("span", { class: PAGE_CLASSES.srOnly }, SAID_BEFORE_A_QUESTION);
  const bubble = make("p", { class: PAGE_CLASSES.question }, saidFirst, "");
  showQuestionIn(bubble, exchange);
  return bubble;
}

/** Adds a line to a reply's messages, under the last answer among them. */
export function addUnderReply(replyMessages: Element[], line: Element): void {
  const lastAnswer = replyMessages.findLast((message) => message.matches(CLASS_SELECTOR.answer));
  (lastAnswer ?? replyMessages.at(-1))?.append(line);
}

/** "2 questions left today", for under a reply. */
export const questionsLeftNote = (questionsLeft: number): Element =>
  make("p", { class: PAGE_CLASSES.from }, words.askLeft.replace("{n}", String(questionsLeft)));

/** "From the Work tab": a link to the tab an answer is from, by its name as
    it's shown (renamed in this browser, if it was). */
function fromLine(tab: HTMLElement, wording: string): Element {
  const title = tab.querySelector(CLASS_SELECTOR.titleText) ?? tab.querySelector(CLASS_SELECTOR.title);
  const [before = "", after = ""] = wording.split("{tab}");
  const link = make("a", { href: `#${tab.id}` }, title?.textContent.trim() ?? tab.id);
  return make("p", { class: PAGE_CLASSES.from }, before, link, after);
}

function addressEmail(message: Element, question: string): void {
  const email = find(message, ATTRIBUTE_SELECTOR.emailBody);
  const [mailto = ""] = (email.getAttribute("href") ?? "").split("?");
  const subject = email.getAttribute(DATA.emailSubject) ?? "";
  const body = withQuestion(email.getAttribute(DATA.emailBody) ?? "", question);
  email.setAttribute("href", emailLink(mailto, subject, body));
}

/** "Something else": how to reach the owner, with the question in the email
    it opens and in a message to copy. A blocked visitor is offered no
    message, and an email to write themselves: nothing they typed is shown
    back. */
function somethingElse(asked: TypedQuestion): Element[] {
  const message = clone(find(askedTab, CLASS_SELECTOR.answer));
  message.querySelector(CLASS_SELECTOR.messageActions)?.remove();
  const question = questionForOwner(asked);
  addressEmail(message, question);
  const draft = message.querySelector(CLASS_SELECTOR.draft);
  if (asked.outcome.kind === "blocked") draft?.remove();
  else if (draft) {
    const wording = draft.getAttribute(DATA.messageDraft) ?? "";
    find(draft, CLASS_SELECTOR.draftText).textContent = withQuestion(wording, question);
  }
  return [message];
}

/** For an answer the page hasn't (the site has changed since it was kept). */
const somethingElseAsTyped = ({ question }: TypedQuestion): Element[] =>
  somethingElse({ kind: "typed", question, outcome: { kind: "unanswered" } });

/** One of the site's answers, word for word, ending with a link to its
    tab. A personal answer's tab has no row in the sidebar: no link. */
function sitesAnswer(asked: QuestionWith<"answered">): Element[] {
  const answer = findAnswer(asked.outcome.answerId);
  if (!answer) return somethingElseAsTyped(asked);
  const messages = copyOfAnswer(answer);
  if (!isPersonalTab(answer.tab.id)) addUnderReply(messages, fromLine(answer.tab, words.askFrom));
  return messages;
}

/** The reply /ask made, as text; under it the site's own lines it was
    written from, word for word, and a link to the tab the rest is in. */
function madeReply(asked: QuestionWith<"replied">): Element[] {
  const { answerId, replyText, citedLines } = asked.outcome;
  const answer = findAnswer(answerId);
  if (!answer) return somethingElseAsTyped(asked);
  const quotedLines = citedLines.map((line) => make("p", {}, line));
  const quoted = quotedLines.length ? [make("blockquote", { class: PAGE_CLASSES.cited }, ...quotedLines)] : [];
  const from = fromLine(answer.tab, isPersonalTab(answer.tab.id) ? words.askFromPersonal : words.askFrom);
  return [
    make("div", { class: PAGE_CLASSES.answer }, make("p", { class: PAGE_CLASSES.reply }, replyText), ...quoted, from),
  ];
}

/** Past the day's questions: a reminder that it's a free service. */
function limitReminder(asked: QuestionWith<"limited">): Element[] {
  const { limit } = asked.outcome;
  // A limit /ask sent without its number is 0: there's no reminder to give.
  if (!limit) return somethingElseAsTyped(asked);
  const reminder = make("p", {}, ...rich(words.askLimited.replace("{limit}", String(limit))));
  return [make("div", { class: PAGE_CLASSES.answer }, reminder)];
}

const REPLY_TO_A_QUESTION: ByOutcome<Element[]> = {
  unasked: somethingElse,
  answered: sitesAnswer,
  replied: madeReply,
  unanswered: somethingElse,
  blocked: somethingElse,
  limited: limitReminder,
};

/** The messages that reply to an exchange: a chosen thread's answers, or
    what came of a question typed in. */
export function replyMessages(exchange: Exchange): Element[] {
  if (exchange.kind === "typed") return byOutcome(exchange, REPLY_TO_A_QUESTION);
  const tab = document.getElementById(exchange.tabId);
  return tab ? copyOfThread(tab) : [];
}

/** An exchange whole: its question, then its reply. Nothing for one that
    asks nothing. */
export const messagesOf = (exchange: Exchange): Element[] =>
  questionOf(exchange) === null ? [] : [questionBubble(exchange), ...replyMessages(exchange)];
