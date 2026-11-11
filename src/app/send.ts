/* Sending into a thread: the visitor's message, the "thinking" line, then
   the reply, a message at a time. In the portfolio's own threads that lasts
   until another tab is opened; in a chat it's kept (chats.ts). */
import type { AskResponse } from "../shared/ask.ts";
import { PAGE_CLASSES } from "../shared/page-data.ts";
import { CLASS, SELECTOR, SIZE, TIMING } from "./constants.ts";
import { find, make } from "./lib/dom.ts";
import { pause, scrollToTop } from "./lib/motion.ts";
import { ask } from "./ask.ts";
import { chatChanged, chatSent, showChat } from "./chats.ts";
import { askUrl, words } from "./page.ts";
import {
  addToReply,
  bubble,
  isAnswer,
  isTyped,
  messagesFor,
  questionFor,
  type Source,
  type TypedQuestion,
} from "./replies.ts";
import { isChat } from "./tabs.ts";

const THINKING_WORDS = words.thinkingWords.split("|").filter(Boolean);

// The "thinking" line while a reply is on its way: three dots, the seconds
// it's taken so far (from 1s), and a word picked at random that stays until
// the reply comes ("3s · Noodling"). Screen readers hear "Thinking…" once,
// as text added to the thread, a live region (main.ts): a label alone
// isn't announced.
function thinkingLine(): HTMLElement {
  const time = make("span", { class: CLASS.thinkingTime, "aria-hidden": "true" });
  const pick = THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)] ?? words.thinking;
  const word = make("span", { class: CLASS.thinkingWord, "aria-hidden": "true" }, pick);
  const dots = make("span", { class: CLASS.thinkingDots, "aria-hidden": "true" }, make("i"), make("i"), make("i"));
  const said = make("span", { class: PAGE_CLASSES.srOnly }, words.thinking);
  const line = make("div", { class: CLASS.thinking }, dots, time, word, said);
  const started = Date.now();
  const clock = setInterval(() => {
    if (!line.isConnected) return clearInterval(clock);
    time.textContent = `${Math.floor((Date.now() - started) / 1000)}s`;
  }, 1000);
  return line;
}

// Keeps what /ask said with the question, so it isn't asked again.
function keepReply(typed: TypedQuestion, reply: AskResponse | null, asked: HTMLElement): void {
  if (reply && "blocked" in reply) {
    // Back to how the site was without Ask: the "Something else" reply, for
    // this question and the rest of the visit. A question /ask found
    // inappropriate is hidden, everywhere it was: the bubble, the chat's
    // name, what's saved.
    typed.blocked = true;
    if (reply.flagged) {
      typed.question = words.askRemoved;
      if (asked.lastChild) asked.lastChild.nodeValue = words.askRemoved;
      asked.classList.add(CLASS.removed);
    }
  } else if (reply && "limited" in reply) typed.limited = reply.limit;
  else {
    typed.answer = reply?.id && isAnswer(reply.id) ? reply.id : null;
    // The reply it wrote with the answer, kept with it too.
    if (typed.answer && reply && "reply" in reply && reply.reply) typed.reply = reply.reply;
  }
}

// The reply's messages, once it has come: after a moment's "thinking" and,
// for a typed question not asked yet, what /ask says (kept with it).
async function replyTo(tab: HTMLElement, source: Source, asked: HTMLElement): Promise<Element[]> {
  // A typed question is sent to /ask once; the answer it picks stays with
  // the chat, so showing the chat again doesn't ask again.
  const typed = isTyped(source) && askUrl && !("answer" in source) ? source : null;
  const [, said] = await Promise.all([pause(TIMING.thinking), typed ? ask(typed.question) : null]);
  if (typed) {
    keepReply(typed, said, asked);
    if (isChat(tab)) chatChanged(tab);
  }
  const reply = messagesFor(source)?.answer ?? [];
  // Few questions left today: say so, under the reply.
  const left = said && "left" in said ? said.left : undefined;
  if (left !== undefined) {
    addToReply(reply, make("p", { class: CLASS.from }, words.askLeft.replace("{n}", String(left))));
  }
  return reply;
}

/** One question sent, and its reply as it goes into the thread. */
type Turn = {
  tab: HTMLElement;
  thread: HTMLElement;
  scroll: HTMLElement;
  /** The question, in the thread, and the "thinking" line under it. */
  asked: HTMLElement;
  thinking: HTMLElement;
  /** The reply's messages, once it has come, and how many are in. */
  reply: Element[] | null;
  shown: number;
  /** The view follows the question until it reaches the top of the thread,
      so a long reply is read from its start; then the scroll is the
      reader's. */
  following: boolean;
  /** Something else was sent: the rest of the reply goes in at once. */
  hurried: boolean;
  /** Another tab opened: no more of it goes in. */
  stopped: boolean;
};

// The turn whose reply is still going in, if there is one.
let current: Turn | null = null;

function markSent(node: Element): Element {
  node.classList.add(CLASS.sent);
  return node;
}

function add(turn: Turn, node: Element): void {
  turn.thread.append(markSent(node));
  if (turn.following) turn.following = !scrollToTop(turn.scroll, turn.asked, SIZE.jumpMargin);
}

// The question and the "thinking" line, in the thread.
function begin(tab: HTMLElement, question: string): Turn {
  const thread = find(tab, SELECTOR.thread);
  thread.querySelector(`:scope > ${SELECTOR.chatHello}`)?.remove();
  const turn: Turn = {
    tab,
    thread,
    scroll: find(tab, SELECTOR.scroll),
    asked: bubble(question),
    thinking: thinkingLine(),
    reply: null,
    shown: 0,
    following: true,
    hurried: false,
    stopped: false,
  };
  add(turn, turn.asked);
  add(turn, turn.thinking);
  return turn;
}

function showNext(turn: Turn): void {
  const node = turn.reply?.[turn.shown++];
  if (node) add(turn, node);
}

// Something else is being sent: the rest of this reply goes in now, or, if
// it hasn't come yet, all at once in the "thinking" line's place.
function hurry(turn: Turn): void {
  turn.hurried = true;
  while (turn.reply && turn.shown < turn.reply.length) showNext(turn);
}

/** Sends `source` into the tab's thread: its question, the "thinking"
    line, then its reply, a message at a time. */
export async function send(tab: HTMLElement, source: Source): Promise<void> {
  const question = questionFor(source);
  if (!question) return;
  if (current) hurry(current);
  if (isChat(tab)) chatSent(tab, source);
  const turn = begin(tab, question);
  current = turn;
  const reply = await replyTo(tab, source, turn.asked);
  if (turn.hurried) return turn.thinking.replaceWith(...reply.map(markSent));
  turn.thinking.remove();
  turn.reply = reply;
  while (turn.shown < reply.length) {
    if (turn.shown > 0) await pause(TIMING.betweenMessages);
    if (turn.hurried) return;
    // A chat stopped part way is shown whole, for when it's opened again.
    if (turn.stopped) return isChat(tab) ? showChat(tab) : undefined;
    showNext(turn);
  }
  if (current === turn) current = null;
}

/** Back to the portfolio's own messages, when another tab opens. */
export function resetThreads(): void {
  if (current) current.stopped = true;
  current = null;
  const sent = `${SELECTOR.tab}:not(${SELECTOR.chatTab}) ${SELECTOR.thread} > ${SELECTOR.sent}`;
  for (const node of document.querySelectorAll(sent)) node.remove();
}
