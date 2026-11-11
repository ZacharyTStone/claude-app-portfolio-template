/* The home screen's box: a question typed in it goes to a new chat as one
   typed into the question card does; a question to start with comes with
   the answer the page names for it, so nothing is asked of /ask. */
import { DATA } from "../shared/page-data.ts";
import { SELECTOR } from "./constants.ts";
import { newChat } from "./chats.ts";
import { findAll, onEnter, query } from "./lib/dom.ts";
import type { Source } from "./replies.ts";
import { send } from "./send.ts";
import { isWide } from "./sidebar.ts";
import { currentTab } from "./tabs.ts";

const input = document.querySelector<HTMLInputElement>(SELECTOR.homeInput);

// Into a new chat, without the question card that a new chat opens with.
const ask = (source: Source) => newChat(false, (tab) => void send(tab, source));

function submit(): void {
  const question = input?.value.trim();
  if (!input || !question) return input?.focus();
  input.value = "";
  ask({ question });
}

/** The cursor in the box, where the home screen shows (not on a phone,
    where it would bring up the keyboard). */
export function focusHome(): void {
  if (isWide() && !currentTab()) input?.focus({ preventScroll: true });
}

export function initHome(): void {
  if (!input) return;
  onEnter(input, submit);
  query(document, SELECTOR.homeSend)?.addEventListener("click", submit);
  for (const prompt of findAll(document, SELECTOR.prompt)) {
    const question = prompt.textContent.trim();
    const answer = prompt.getAttribute(DATA.prompt);
    if (question && answer) prompt.addEventListener("click", () => ask({ question, answer }));
  }
}
