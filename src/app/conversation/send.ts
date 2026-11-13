/* Sending into a thread: the visitor's message, the "thinking" line, then
   the reply, a message at a time. In the portfolio's own threads that lasts
   until another tab is opened; in a chat it's kept (chats.ts). */
import type { AskResponse } from "../../contracts/ask.ts";
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { SIZE } from "../constants.ts";
import { find } from "../lib/dom.ts";
import { pause, scrollToTop } from "../lib/motion.ts";
import { askUrl, words } from "../page.ts";
import { isChat } from "../tabs.ts";
import { ask } from "./ask.ts";
import { addToChat, showChat, updateInChat } from "./chats.ts";
import { isUnasked, outcomeOf, withOutcome, type Exchange, type TypedQuestion } from "./exchange.ts";
import {
  addUnderReply,
  questionBubble,
  questionOf,
  questionsLeftNote,
  replyMessages,
  showQuestionIn,
} from "./messages.ts";
import { isOnPage } from "./page-answers.ts";
import { thinkingLine } from "./thinking.ts";

/** The least a reply takes, "thinking", before it comes. */
const THINKING_MS = 750;
const BETWEEN_MESSAGES_MS = 140;

const SENT_INTO_THE_SITES_OWN_THREADS = `${CLASS_SELECTOR.tab}:not(${ATTRIBUTE_SELECTOR.chat}) ${CLASS_SELECTOR.thread} > ${CLASS_SELECTOR.sent}`;

/** One exchange as it goes into a thread. */
type Delivery = {
  tab: HTMLElement;
  thread: HTMLElement;
  scroller: HTMLElement;
  questionBubble: HTMLElement;
  thinkingLine: HTMLElement;
  /** Where the exchange is kept in its chat; null in one of the site's own tabs. */
  placeInChat: number | null;
  /** Null until the reply has come. */
  replyMessages: Element[] | null;
  shownCount: number;
  /** The view follows the question until it reaches the top of the thread,
      so a long reply is read from its start; then the scroll is the
      reader's. */
  isFollowingQuestion: boolean;
  /** Something else was sent: the rest of the reply goes in at once. */
  isHurried: boolean;
  /** Another tab opened: no more of it goes in. */
  isStopped: boolean;
};

/** The delivery whose reply is still going in, if there is one. */
let current: Delivery | null = null;

function markSent(message: Element): Element {
  message.classList.add(PAGE_CLASSES.sent);
  return message;
}

function add(delivery: Delivery, message: Element): void {
  delivery.thread.append(markSent(message));
  if (!delivery.isFollowingQuestion) return;
  const reachedTheTop = scrollToTop(delivery.scroller, delivery.questionBubble, SIZE.jumpMargin);
  delivery.isFollowingQuestion = !reachedTheTop;
}

/** Puts the question and the "thinking" line in the thread, in place of a
    new chat's "who this is". */
function begin(tab: HTMLElement, exchange: Exchange, placeInChat: number | null): Delivery {
  const thread = find(tab, CLASS_SELECTOR.thread);
  thread.querySelector(`:scope > ${CLASS_SELECTOR.chatHello}`)?.remove();
  const delivery: Delivery = {
    tab,
    thread,
    scroller: find(tab, CLASS_SELECTOR.scroll),
    questionBubble: questionBubble(exchange),
    thinkingLine: thinkingLine(),
    placeInChat,
    replyMessages: null,
    shownCount: 0,
    isFollowingQuestion: true,
    isHurried: false,
    isStopped: false,
  };
  add(delivery, delivery.questionBubble);
  add(delivery, delivery.thinkingLine);
  return delivery;
}

function showNext(delivery: Delivery): void {
  const message = delivery.replyMessages?.[delivery.shownCount++];
  if (message) add(delivery, message);
}

/** The rest of a reply goes in now; one that hasn't come yet will go in all
    at once, in the "thinking" line's place. */
function hurry(delivery: Delivery): void {
  delivery.isHurried = true;
  while (delivery.replyMessages && delivery.shownCount < delivery.replyMessages.length) showNext(delivery);
}

/** What /ask said of a question is shown in its bubble (one it found
    inappropriate is removed) and kept with its chat, so it's asked once. */
function keepOutcome(delivery: Delivery, asked: TypedQuestion, response: AskResponse | null): TypedQuestion {
  const answered = withOutcome(asked, outcomeOf(response, isOnPage), words.askRemoved);
  showQuestionIn(delivery.questionBubble, answered);
  if (delivery.placeInChat !== null) updateInChat(delivery.tab, delivery.placeInChat, answered);
  return answered;
}

/** The reply's messages, once it has come: after a moment's "thinking" and,
    for a question not asked yet, what /ask says of it. */
async function replyOnceItComes(delivery: Delivery, exchange: Exchange): Promise<Element[]> {
  const toAsk = askUrl && isUnasked(exchange) ? exchange : null;
  const [, response] = await Promise.all([pause(THINKING_MS), toAsk ? ask(toAsk.question) : null]);
  const messages = replyMessages(toAsk ? keepOutcome(delivery, toAsk, response) : exchange);
  const questionsLeft = response?.left;
  if (questionsLeft !== undefined) addUnderReply(messages, questionsLeftNote(questionsLeft));
  return messages;
}

/** Puts a reply in, a message at a time, until it's all in or something
    else is sent (the rest then goes in at once) or another tab opens. */
async function showOneByOne(delivery: Delivery, messages: Element[]): Promise<void> {
  delivery.replyMessages = messages;
  while (delivery.shownCount < messages.length) {
    if (delivery.shownCount > 0) await pause(BETWEEN_MESSAGES_MS);
    if (delivery.isHurried) return;
    // A chat stopped part way is shown whole, for when it's opened again.
    if (delivery.isStopped) return showChat(delivery.tab);
    showNext(delivery);
  }
  if (current === delivery) current = null;
}

/** Sends an exchange into the tab's thread: its question, the "thinking"
    line, then its reply, a message at a time. */
export async function send(tab: HTMLElement, exchange: Exchange): Promise<void> {
  if (questionOf(exchange) === null) return;
  if (current) hurry(current);
  const placeInChat = isChat(tab) ? addToChat(tab, exchange) : null;
  const delivery = begin(tab, exchange, placeInChat);
  current = delivery;
  const messages = await replyOnceItComes(delivery, exchange);
  if (delivery.isHurried) return delivery.thinkingLine.replaceWith(...messages.map(markSent));
  delivery.thinkingLine.remove();
  await showOneByOne(delivery, messages);
}

/** Back to the portfolio's own messages, when another tab opens. */
export function resetThreads(): void {
  if (current) current.isStopped = true;
  current = null;
  for (const message of document.querySelectorAll(SENT_INTO_THE_SITES_OWN_THREADS)) message.remove();
}
