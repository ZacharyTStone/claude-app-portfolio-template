/* What's sent into a thread, and the reply it gets: the site's own answers,
   copied from the page (a thread's, the one /ask picked, or "Something
   else"), or /ask's reply when it sent one (src/shared/ask.ts). */
import { isCitedLines, isReplyText } from "../shared/ask.ts";
import { ID } from "../shared/config.ts";
import { DATA, PAGE_CLASSES } from "../shared/page-data.ts";
import { CLASS, SELECTOR } from "./constants.ts";
import { clone, find, make } from "./lib/dom.ts";
import { rich } from "./lib/markdown.ts";
import { askedTab, questionText, words } from "./page.ts";
import { isPersonalTab } from "./personal.ts";

/** A question typed in. What /ask said about it is kept with it, so it's
    asked only once (a chat shown again doesn't ask again). */
export type TypedQuestion = {
  question: string;
  /** The answer /ask picked ("work.2"), or null for none. Left out
      until it's asked, and when Ask is off. */
  answer?: string | null;
  /** The reply /ask sent with that answer, if it sent one. */
  reply?: string;
  /** The site's own lines that reply was written from, which /ask sends
      with a reply it wrote itself: they're shown under it. */
  cited?: string[];
  /** The visitor is blocked: nothing they type is shown back. */
  blocked?: true;
  /** They're past the day's limit, of this many questions. */
  limited?: number;
};

/** What's sent: a thread chosen in the question card, or a question typed
    in. A chat is saved as a list of these. */
export type Source = { tab: string } | TypedQuestion;

export const isTyped = (source: Source): source is TypedQuestion => "question" in source;

// "Question: ", said before each question to screen readers.
const SR_QUESTION = document.querySelector(`${SELECTOR.question} ${SELECTOR.srOnly}`)?.textContent ?? "";

/** The visitor's message. */
export const bubble = (question: string): HTMLElement =>
  make("p", { class: PAGE_CLASSES.question }, make("span", { class: PAGE_CLASSES.srOnly }, SR_QUESTION), question);

/** What a source asks: the question typed in, or the thread's first. */
export function questionFor(source: Source): string | null {
  if (isTyped(source)) return source.question || null;
  const q = document.getElementById(source.tab)?.querySelector(SELECTOR.threadQuestion);
  return q ? questionText(q) : null;
}

// A message to send again: without its buttons, or ids the page already
// has.
function copyMessage(node: Element): Element {
  const copy = clone(node);
  copy.querySelectorAll(SELECTOR.messageActions).forEach((actions) => actions.remove());
  copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  return copy;
}

/** Adds a line to a reply, under its last answer. */
export function addToReply(reply: Element[], line: Element): void {
  (reply.findLast((node) => node.matches(SELECTOR.answer)) ?? reply.at(-1))?.append(line);
}

// "From the Work tab": a line linking to the tab an answer is from, by its
// name as it's shown (renamed in this browser, if it was).
function fromLine(tab: HTMLElement, template: string): Element {
  const title = (tab.querySelector(SELECTOR.titleText) ?? tab.querySelector(SELECTOR.title))?.textContent;
  const [before = "", after = ""] = template.split("{tab}");
  const link = make("a", { href: `#${tab.id}` }, title?.trim() ?? tab.id);
  return make("p", { class: CLASS.from }, before, link, after);
}

// The tab and the question an answer's id names ("work.2": the second
// question in Work), if it names one.
function findAnswer(id: string): { tab: HTMLElement; q: Element } | null {
  const [tabId = "", n = ""] = id.split(".");
  const tab = ID.test(tabId) ? document.getElementById(tabId) : null;
  if (!tab?.matches(SELECTOR.tab)) return null;
  const q = tab.querySelectorAll(`${SELECTOR.threadQuestion}:not(${SELECTOR.sent})`)[Number(n) - 1];
  return q ? { tab, q } : null;
}

/** Whether an answer's id names one of the page's answers. */
export const isAnswer = (id: string): boolean => findAnswer(id) !== null;

// The site's own lines a reply was written from, quoted under it: what the
// site itself says, word for word, beside what the model made of it.
const citedLines = (lines: string[]): HTMLElement =>
  make("blockquote", { class: CLASS.cited }, ...lines.map((line) => make("p", {}, line)));

/** One answer as /ask names it, word for word, ending with a link to its
    tab. With a reply from /ask, the reply instead, then the lines it was
    written from (`cited`, when /ask sent them), and the link to the tab the
    rest is in (a personal answer gets one too). Null for an id that names
    none. */
export function answerFor(id: string, reply?: string, cited: string[] = []): Element[] | null {
  const found = findAnswer(id);
  if (!found) return null;
  const { tab, q } = found;
  const personal = isPersonalTab(tab.id);
  if (reply !== undefined) {
    // The reply as text, then its source; the whole answer is a click
    // away, in its tab.
    const from = fromLine(tab, personal ? words.askFromPersonal : words.askFrom);
    const source = cited.length ? [citedLines(cited)] : [];
    return [make("div", { class: PAGE_CLASSES.answer }, make("p", { class: CLASS.reply }, reply), ...source, from)];
  }
  const answer: Element[] = [];
  for (let node = q.nextElementSibling; node && !node.matches(SELECTOR.question); node = node.nextElementSibling) {
    if (!node.matches(SELECTOR.sent)) answer.push(copyMessage(node));
  }
  // A personal answer's tab has no row in the sidebar: on its own, no "From" line.
  if (!personal) addToReply(answer, fromLine(tab, words.askFrom));
  return answer;
}

// "Something else": how to reach you, with the question in an email and in
// a LinkedIn message to copy, as it was typed. For a visitor who's been
// blocked it's the same, but nothing they typed is shown back: no message
// to copy, and an email for them to write.
function somethingElse(question: string, blocked: boolean): Element {
  const answer = clone(find(askedTab, SELECTOR.answer));
  answer.querySelector(SELECTOR.messageActions)?.remove();
  const asked = blocked ? "" : question;
  // A function, so a "$" in the question is just a "$".
  const fill = (template: string) => template.replaceAll("{question}", () => asked);
  const mail = find(answer, SELECTOR.mail);
  // The address, without the subject and body the page gives it.
  const [address = ""] = (find(askedTab, SELECTOR.mail).getAttribute("href") ?? "").split("?");
  const subject = encodeURIComponent(mail.getAttribute(DATA.subject) ?? "");
  const body = encodeURIComponent(fill(mail.getAttribute(DATA.mail) ?? ""));
  mail.setAttribute("href", `${address}?subject=${subject}&body=${body}`);
  const draft = answer.querySelector(SELECTOR.draft);
  if (draft instanceof HTMLElement && blocked) draft.remove();
  else if (draft instanceof HTMLElement)
    find(draft, SELECTOR.draftText).textContent = fill(draft.getAttribute(DATA.draft) ?? "");
  return answer;
}

// A thread's answers as one reply: its later questions aren't sent as if
// the visitor had asked them, and anything sent into it isn't part of its
// answer.
function threadReply(tab: HTMLElement): Element[] {
  const answer: Element[] = [];
  let reply: Element | null = null;
  for (const node of [...find(tab, SELECTOR.thread).children].slice(1)) {
    if (node.matches(`${SELECTOR.question}, ${SELECTOR.sent}`)) continue;
    const copy = copyMessage(node);
    if (copy.matches(SELECTOR.answer)) {
      if (reply) reply.append(...copy.childNodes);
      else answer.push((reply = copy));
    } else if (reply) reply.append(copy);
    else answer.push(copy);
  }
  return answer;
}

/** What a source sends: its question, and the reply. */
export function messagesFor(source: Source): { question: string; answer: Element[] } | null {
  const question = questionFor(source);
  if (!question) return null;
  if (!isTyped(source)) {
    const tab = document.getElementById(source.tab);
    return tab ? { question, answer: threadReply(tab) } : null;
  }
  // Past the day's questions: a reminder that it's a free service.
  if (source.limited) {
    const reminder = make("p", {}, ...rich(words.askLimited.replace("{limit}", String(source.limited))));
    return { question, answer: [make("div", { class: PAGE_CLASSES.answer }, reminder)] };
  }
  // A reply kept with a chat is checked again, as are the lines it cites:
  // either may have been edited. The lines only ever come with a reply.
  const reply = isReplyText(source.reply) ? source.reply : undefined;
  const cited = reply !== undefined && isCitedLines(source.cited) ? source.cited : [];
  const picked = source.answer ? answerFor(source.answer, reply, cited) : null;
  return { question, answer: picked ?? [somethingElse(question, source.blocked === true)] };
}
