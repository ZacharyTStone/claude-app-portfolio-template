/* The home screen: its greeting, in the visitor's own time of day, and its
   box. A question typed in the box goes to a new chat as one typed into the
   question card does; a question to start with comes with the answer the
   page names for it, so nothing is asked of /ask. */
import { HOURS, partOfDay } from "../contracts/day-parts.ts";
import { DATA } from "../contracts/page-attributes.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { questionWithAnswer, typedQuestion } from "./conversation/exchange.ts";
import { findAll, onEnter, query } from "./lib/dom.ts";
import { askInNewChat } from "./navigation.ts";
import { greetings, homeGreeting } from "./page.ts";
import { isWide } from "./sidebar.ts";
import { currentTab } from "./tabs.ts";

const HOME_INPUT = `${CLASS_SELECTOR.homeAsk} input`;
const HOME_SEND = `${CLASS_SELECTOR.homeAsk} ${CLASS_SELECTOR.homeSend}`;

/** The box to type a question in. A page without one has no home screen
    to wire. */
const homeInput = document.querySelector<HTMLInputElement>(HOME_INPUT);

/** Greets the visitor by their time of day ("Up late?" after 11pm). A part
    of the day the page has no words for keeps the greeting it came with. */
export function greet(): void {
  const visitorHour = new Date().getHours();
  const greeting = greetings[partOfDay(visitorHour, HOURS.greeting)];
  if (greeting) homeGreeting.textContent = greeting;
}

/** Sends what's typed in the box, and empties it. With nothing typed, the
    cursor goes to the box instead. */
function sendTypedQuestion(): void {
  const question = homeInput?.value.trim();
  if (!homeInput || !question) return homeInput?.focus();
  homeInput.value = "";
  askInNewChat(typedQuestion(question));
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
    const answerId = starter.getAttribute(DATA.prompt);
    if (question && answerId) {
      starter.addEventListener("click", () => askInNewChat(questionWithAnswer(question, answerId)));
    }
  }
}
