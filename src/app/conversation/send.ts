/* Sending into a thread: the visitor's message, the "thinking" line, then
   the reply, a message at a time. In the portfolio's own threads that lasts
   until another tab is opened; in a chat it's kept (chats.ts). */
import type { AskResponse, AskTurn } from "../../contracts/ask.ts";
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { SIZE } from "../constants.ts";
import { find } from "../lib/dom.ts";
import { pause, scrollToTop } from "../lib/motion.ts";
import { askUrl, words } from "../page.ts";
import { watchForTurnsIn } from "../play.ts";
import { isChat } from "../tabs.ts";
import { ask } from "./ask.ts";
import { addToChat, listLinksOfChat, sentInChat, updateInChat } from "./chats.ts";
import { isUnasked, outcomeOf, withOutcome, type Exchange, type TypedQuestion } from "./exchange.ts";
import { lastTurns, turnOf } from "./follow-up.ts";
import {
  addUnderReply,
  questionBubble,
  questionOf,
  questionsLeftNote,
  replyMessages,
  showQuestionIn,
} from "./messages.ts";
import { answersReadIn, firstQuestionOf, isOnPage } from "./page-answers.ts";
import { finishStreaming, streamIn } from "./stream.ts";
import { thinkingLine } from "./thinking.ts";

/** The least a reply takes, "thinking", before it comes, and the least
    between one of its messages and the next (which waits for the one
    before to come in, a word at a time: stream.ts). */
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
  /** The exchange, with what /ask said of it once it has. */
  exchange: Exchange;
  /** What came before it in its chat or tab, for /ask. */
  earlier: AskTurn[];
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

/** The site's own tab that's open, once a question is sent into it: its
    answers down to the one being read then, and what's been sent into it
    since. A chat keeps its own (chats.ts). */
let openTab: { tab: HTMLElement; answersRead: AskTurn[]; sent: Delivery[] } | null = null;

const turnIn = (exchange: Exchange) => turnOf(exchange, firstQuestionOf);

/** The turns before a question sent into `tab` now: in a chat, what was
    sent in it; in one of the site's own tabs, its answers down to the one
    being read, then what was sent into it. */
function earlierIn(tab: HTMLElement): AskTurn[] {
  const inChat = sentInChat(tab);
  if (inChat) return lastTurns(inChat.map(turnIn));
  if (isChat(tab)) return [];
  // What's sent goes in below the tab's own answers, so the one being read
  // is the one the first question was asked over.
  if (openTab?.tab !== tab) openTab = { tab, answersRead: answersReadIn(tab), sent: [] };
  return lastTurns([...openTab.answersRead, ...openTab.sent.map(({ exchange }) => turnIn(exchange))]);
}

function markSent(message: Element): Element {
  message.classList.add(PAGE_CLASSES.sent);
  return message;
}

/** Puts messages at the end of a thread, where a picture in them has its
    turn to play by itself (play.ts). */
function putIn(thread: HTMLElement, messages: Element[]): void {
  thread.append(...messages.map(markSent));
  watchForTurnsIn(messages);
}

function add(delivery: Delivery, message: Element): void {
  putIn(delivery.thread, [message]);
  if (!delivery.isFollowingQuestion) return;
  const reachedTheTop = scrollToTop(delivery.scroller, delivery.questionBubble, SIZE.jumpMargin);
  delivery.isFollowingQuestion = !reachedTheTop;
}

/** Keeps the exchange with its chat, if it's sent in one, and puts the
    question and the "thinking" line in the thread, in place of a new
    chat's "who this is". */
function begin(tab: HTMLElement, exchange: Exchange, earlier: AskTurn[]): Delivery {
  const placeInChat = isChat(tab) ? addToChat(tab, exchange) : null;
  const thread = find(tab, CLASS_SELECTOR.thread);
  thread.querySelector(`:scope > ${CLASS_SELECTOR.chatHello}`)?.remove();
  const delivery: Delivery = {
    tab,
    thread,
    exchange,
    earlier,
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

/** Puts the reply's next message in, coming in a word at a time unless the
    reply is hurried, and says how long that takes. */
function showNext(delivery: Delivery): number {
  const message = delivery.replyMessages?.[delivery.shownCount++];
  if (!message) return 0;
  const takes = delivery.isHurried ? 0 : streamIn(message);
  add(delivery, message);
  return takes;
}

/** All of a reply that's in shows whole. */
function finishAll(delivery: Delivery): void {
  for (const message of delivery.replyMessages ?? []) finishStreaming(message);
}

/** The rest of a reply goes in now; one that hasn't come yet will go in all
    at once, in the "thinking" line's place. */
function hurry(delivery: Delivery): void {
  delivery.isHurried = true;
  finishAll(delivery);
  while (delivery.replyMessages && delivery.shownCount < delivery.replyMessages.length) showNext(delivery);
}

/** What /ask said of a question is shown in its bubble (one it found
    inappropriate is removed) and kept with its chat, so it's asked once. */
function keepOutcome(delivery: Delivery, asked: TypedQuestion, response: AskResponse | null): TypedQuestion {
  const answered = withOutcome(asked, outcomeOf(response, isOnPage), words.askRemoved);
  delivery.exchange = answered;
  showQuestionIn(delivery.questionBubble, answered);
  if (delivery.placeInChat !== null) updateInChat(delivery.tab, delivery.placeInChat, answered);
  return answered;
}

/** The reply's messages, once it has come: after a moment's "thinking" and,
    for a question not asked yet, what /ask says of it. */
async function replyOnceItComes(delivery: Delivery, exchange: Exchange): Promise<Element[]> {
  const toAsk = askUrl && isUnasked(exchange) ? exchange : null;
  const [, response] = await Promise.all([pause(THINKING_MS), toAsk ? ask(toAsk.question, delivery.earlier) : null]);
  const messages = replyMessages(toAsk ? keepOutcome(delivery, toAsk, response) : exchange);
  const questionsLeft = response?.left;
  if (questionsLeft !== undefined) addUnderReply(messages, questionsLeftNote(questionsLeft));
  return messages;
}

/** The rest of a reply in a chat that was left part way through it goes in
    at once, for when it's opened again: after what's in already, whose
    pictures keep the turns they have. In one of the site's own tabs, what
    was sent is gone already (resetThreads). */
function putInTheRest(delivery: Delivery, messages: Element[]): void {
  if (isChat(delivery.tab)) putIn(delivery.thread, messages.slice(delivery.shownCount));
}

/** Puts a reply in, a message at a time, until it's all in or something
    else is sent (the rest then goes in at once) or another tab opens. */
async function showOneByOne(delivery: Delivery, messages: Element[]): Promise<void> {
  delivery.replyMessages = messages;
  let comingIn = 0;
  while (delivery.shownCount < messages.length) {
    if (delivery.shownCount > 0) await pause(Math.max(BETWEEN_MESSAGES_MS, comingIn));
    if (delivery.isHurried) return;
    if (delivery.isStopped) return putInTheRest(delivery, messages);
    comingIn = showNext(delivery);
  }
  if (current === delivery) current = null;
}

/** Sends an exchange into the tab's thread: its question, the "thinking"
    line, then its reply, a message at a time. */
export async function send(tab: HTMLElement, exchange: Exchange): Promise<void> {
  if (questionOf(exchange) === null) return;
  if (current) hurry(current);
  // Before it's kept with its chat, which would make it one of its own
  // earlier turns.
  const delivery = begin(tab, exchange, earlierIn(tab));
  if (openTab?.tab === tab) openTab.sent.push(delivery);
  current = delivery;
  const messages = await replyOnceItComes(delivery, exchange);
  listLinksOfChat(tab);
  if (delivery.isHurried) {
    delivery.thinkingLine.replaceWith(...messages.map(markSent));
    return watchForTurnsIn(messages);
  }
  delivery.thinkingLine.remove();
  await showOneByOne(delivery, messages);
}

/** Back to the portfolio's own messages, when another tab opens. */
export function resetThreads(): void {
  if (current) {
    current.isStopped = true;
    finishAll(current);
  }
  current = null;
  openTab = null;
  for (const message of document.querySelectorAll(SENT_INTO_THE_SITES_OWN_THREADS)) message.remove();
}
