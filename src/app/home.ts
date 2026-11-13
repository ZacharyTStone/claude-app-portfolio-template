/* The home screen's box: a question typed in it goes to a new chat as one
   typed into the question card does; a question to start with comes with
   the answer the page names for it, so nothing is asked of /ask. */
import { DATA } from "../contracts/page-attributes.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { newChat } from "./chats.ts";
import { findAll, onEnter, query } from "./lib/dom.ts";
import type { Source } from "./replies.ts";
import { send } from "./send.ts";
import { isWide } from "./sidebar.ts";
import { currentTab } from "./tabs.ts";

const HOME_INPUT = `${CLASS_SELECTOR.homeAsk} input`;
const HOME_SEND = `${CLASS_SELECTOR.homeAsk} ${CLASS_SELECTOR.homeSend}`;

/** The box to type a question in. A page without one has no home screen
    to wire. */
const homeInput = document.querySelector<HTMLInputElement>(HOME_INPUT);

/** Sends a question into a new chat, without the question card that a new
    chat opens with. */
function askInNewChat(source: Source): void {
  // Back from the chat returns to the home screen: it isn't replaced.
  const replaceInHistory = false;
  newChat(replaceInHistory, (chatTab) => void send(chatTab, source));
}

/** Sends what's typed in the box, and empties it. With nothing typed, the
    cursor goes to the box instead. */
function sendTypedQuestion(): void {
  const question = homeInput?.value.trim();
  if (!homeInput || !question) return homeInput?.focus();
  homeInput.value = "";
  askInNewChat({ question });
}

/** The cursor in the box, where the home screen shows (not on a phone,
    where it would bring up the keyboard). */
export function focusHome(): void {
  const isHomeShowing = !currentTab();
  if (isWide() && isHomeShowing) homeInput?.focus({ preventScroll: true });
}

/** Wires the box and its send button, and the questions to start with
    under it: each sends its own words, with the answer the page names for
    it (DATA.prompt). */
export function initHome(): void {
  if (!homeInput) return;
  onEnter(homeInput, sendTypedQuestion);
  query(document, HOME_SEND)?.addEventListener("click", sendTypedQuestion);
  for (const starter of findAll(document, ATTRIBUTE_SELECTOR.prompt)) {
    const question = starter.textContent.trim();
    const answer = starter.getAttribute(DATA.prompt);
    if (question && answer) starter.addEventListener("click", () => askInNewChat({ question, answer }));
  }
}
