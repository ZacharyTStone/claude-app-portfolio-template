/* The page this runs on: the elements the script works with, and what it
   says. Each page carries its own wording and question card, so one script
   serves every language. */
import {
  ALL_SCRIPT_STRINGS,
  DATA,
  HOURS,
  PAGE_IDS,
  dataAttribute,
  type Choice,
  type GreetingPart,
  type PersonalAnswer,
  type QuestionCard,
  type QuestionCardWords,
  type ScriptStrings,
  type Topic,
} from "../shared/page-data.ts";
import { isArrayOf, isOptionalBoolean, isOptionalString, isRecord, isString } from "../shared/guards.ts";
import { SELECTOR } from "./constants.ts";
import { byId, parentOf } from "./lib/dom.ts";

export const root = document.documentElement;

/** The script's wording, in the page's language. An optional string the
    page doesn't carry (for a part the site doesn't have) is "". */
export const words = Object.fromEntries(
  ALL_SCRIPT_STRINGS.map((key) => [key, root.getAttribute(`data-${dataAttribute(key)}`) ?? ""]),
) as ScriptStrings;

/** Where a typed question goes (/ask), or "" when Ask is off. */
export const askUrl = root.getAttribute(DATA.ask) ?? "";

/** The sidebar of tabs. */
export const side = byId(PAGE_IDS.tabs);
/** The shell around the sidebar, the open tab and the panel. */
export const app = parentOf(side);
export const main = byId(PAGE_IDS.main);
/** The details panel on the right. */
export const panel = byId(PAGE_IDS.details);
/** The home screen's greeting. */
export const hello = byId(PAGE_IDS.hello);
/** The "Something else" tab: the reply to a question the site can't answer. */
export const askedTab = byId(PAGE_IDS.asked);

/** Whose site this is: the name at the top of the sidebar. */
export const siteName = side.querySelector(SELECTOR.wordmark)?.textContent.trim() ?? "";
export const pageTitle = document.title;

// The home screen's words, beside its greeting.
const home = parentOf(hello);
/** A greeting for each part of the day. */
export const greetings = Object.fromEntries(
  Object.keys(HOURS.greeting).map((part) => [part, home.getAttribute(DATA.greet(part as GreetingPart))]),
) as Record<GreetingPart, string | null>;
/** Who this is, in one line. */
export const tagline = home.getAttribute(DATA.tagline);

/** A question's words, without the "Question:" said only to screen readers. */
export function questionText(q: Element): string {
  return [...q.childNodes]
    .filter((node) => !(node instanceof Element && node.matches(SELECTOR.srOnly)))
    .map((node) => node.textContent)
    .join("")
    .trim();
}

// ---- The question card's data --------------------------------------------------
// Checked, not trusted: if it isn't what the build writes, the card has no
// topics and there are no personal answers.

const NO_QUESTIONS: QuestionCard = {
  ask: "",
  topics: [],
  personal: [],
  ui: { else: "", elseLabel: "", send: "", back: "", step: "", followUp: "" },
};

const isChoice = (value: unknown): value is Choice =>
  isRecord(value) && isString(value.tab) && isOptionalString(value.label) && isOptionalString(value.hint);

const isTopic = (value: unknown): value is Topic =>
  isRecord(value) &&
  isString(value.label) &&
  [value.hint, value.tab, value.ask].every(isOptionalString) &&
  (value.choices === undefined || isArrayOf(value.choices, isChoice)) &&
  isOptionalBoolean(value.personal);

const isParagraph = (value: unknown): value is string | string[] => isString(value) || isArrayOf(value, isString);

const isPersonal = (value: unknown): value is PersonalAnswer =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.q) &&
  isArrayOf(value.a, isParagraph) &&
  isOptionalString(value.title) &&
  isOptionalString(value.hint) &&
  isOptionalBoolean(value.hidden);

const isCardWords = (value: unknown): value is QuestionCardWords =>
  isRecord(value) && Object.keys(NO_QUESTIONS.ui).every((key) => isString(value[key]));

const isQuestionCard = (value: unknown): value is QuestionCard =>
  isRecord(value) &&
  isString(value.ask) &&
  isArrayOf(value.topics, isTopic) &&
  isArrayOf(value.personal, isPersonal) &&
  isCardWords(value.ui);

function readQuestions(): QuestionCard {
  try {
    const data: unknown = JSON.parse(document.getElementById(PAGE_IDS.questions)?.textContent ?? "");
    return isQuestionCard(data) ? data : NO_QUESTIONS;
  } catch {
    return NO_QUESTIONS;
  }
}

/** The question card: its topics, and the personal answers. */
export const questions = readQuestions();
