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
import { isArrayOf, isOptionalBoolean, isOptionalString, isRecord, isString, type Guard } from "../shared/guards.ts";
import { SELECTOR } from "./constants.ts";
import { byId, parentOf } from "./lib/dom.ts";

/** The page's <html>: it carries the page's language, the script's wording
    and where /ask is. */
export const root = document.documentElement;

/** Every script string, as its data-* attribute on <html> has it. */
function readScriptStrings(): ScriptStrings {
  const wording = ALL_SCRIPT_STRINGS.map((name) => [name, root.getAttribute(`data-${dataAttribute(name)}`) ?? ""]);
  // Object.fromEntries forgets which keys it was given.
  return Object.fromEntries(wording) as ScriptStrings;
}

/** The script's wording, in the page's language. An optional string the
    page doesn't carry (for a part the site doesn't have) is "". */
export const words = readScriptStrings();

/** Where a typed question goes (/ask), or "" when Ask is off. */
export const askUrl = root.getAttribute(DATA.ask) ?? "";

/** The sidebar of tabs. */
export const side = byId(PAGE_IDS.tabs);
/** The shell around the sidebar, the open tab and the panel. */
export const shell = parentOf(side);
/** What holds the home screen and every tab; a chat's tab is added to it. */
export const main = byId(PAGE_IDS.main);
/** The details panel on the right. */
export const detailsPanel = byId(PAGE_IDS.details);
/** The home screen's greeting, which is its heading. */
export const homeGreeting = byId(PAGE_IDS.hello);
/** The "Something else" tab: the reply to a question the site can't answer. */
export const askedTab = byId(PAGE_IDS.asked);

/** Whose site this is: the name at the top of the sidebar. */
export const siteName = side.querySelector(SELECTOR.wordmark)?.textContent.trim() ?? "";
/** The window title the page came with, which is the home screen's. */
export const pageTitle = document.title;

// The home screen carries its own words, on the element around its greeting.
const homeScreen = parentOf(homeGreeting);

/** The greeting the page has for each part of the day (null for one it
    doesn't have). */
function readGreetings(): Record<GreetingPart, string | null> {
  const parts = Object.keys(HOURS.greeting) as GreetingPart[];
  const greetingByPart = parts.map((part) => [part, homeScreen.getAttribute(DATA.greet(part))]);
  return Object.fromEntries(greetingByPart) as Record<GreetingPart, string | null>;
}

/** A greeting for each part of the day. */
export const greetings = readGreetings();
/** Who this is, in one line. */
export const tagline = homeScreen.getAttribute(DATA.tagline);

/** A question's words, without the "Question:" said only to screen readers. */
export function questionText(question: Element): string {
  return [...question.childNodes]
    .filter((node) => !(node instanceof Element && node.matches(SELECTOR.srOnly)))
    .map((node) => node.textContent)
    .join("")
    .trim();
}

// ---- The question card's data --------------------------------------------------
// The page carries it as JSON. Checked, not trusted: if it isn't what the
// build writes, the card has no topics and there are no personal answers.
//
// The shapes are checked by hand, field by field. A schema library would
// say them in fewer words, but this is the script every visitor loads, and
// the one that's installed (valibot) adds 4 KB to it for this one check.

/** A check for each field of an object. A field of `Shape` left out of the
    list doesn't compile, so a field added to the page's data
    (src/shared/page-data.ts) has to be checked here too. */
type FieldChecks<Shape> = { [Field in keyof Shape]-?: Guard<Shape[Field]> };

/** A check for an object by its fields: each has to pass its own check. */
function isShape<Shape>(fieldChecks: FieldChecks<Shape>): Guard<Shape> {
  const checks = Object.entries<Guard<unknown>>(fieldChecks);
  return (value): value is Shape => isRecord(value) && checks.every(([field, isValid]) => isValid(value[field]));
}

/** A check for a list, every item of which passes `isItem`. */
const isListOf =
  <Item>(isItem: Guard<Item>): Guard<Item[]> =>
  (value): value is Item[] =>
    isArrayOf(value, isItem);

/** A check for a field that may be left out. */
const isOptional =
  <Value>(isValue: Guard<Value>): Guard<Value | undefined> =>
  (value): value is Value | undefined =>
    value === undefined || isValue(value);

const isChoice = isShape<Choice>({ tab: isString, label: isOptionalString, hint: isOptionalString });

const isTopic = isShape<Topic>({
  label: isString,
  hint: isOptionalString,
  tab: isOptionalString,
  ask: isOptionalString,
  choices: isOptional(isListOf(isChoice)),
  personal: isOptionalBoolean,
});

/** One part of a personal answer: a paragraph, or a list of lines. */
const isParagraphOrList: Guard<string | string[]> = (value): value is string | string[] =>
  isString(value) || isArrayOf(value, isString);

const isPersonalAnswer = isShape<PersonalAnswer>({
  id: isString,
  q: isString,
  a: isListOf(isParagraphOrList),
  title: isOptionalString,
  hint: isOptionalString,
  hidden: isOptionalBoolean,
});

const isQuestionCardWords = isShape<QuestionCardWords>({
  else: isString,
  elseLabel: isString,
  send: isString,
  back: isString,
  step: isString,
  followUp: isString,
});

const isQuestionCard = isShape<QuestionCard>({
  ask: isString,
  topics: isListOf(isTopic),
  personal: isListOf(isPersonalAnswer),
  ui: isQuestionCardWords,
});

/** The card a page gets when its data isn't what the build writes: no
    topics, no personal answers and no words. */
const EMPTY_QUESTION_CARD: QuestionCard = {
  ask: "",
  topics: [],
  personal: [],
  ui: { else: "", elseLabel: "", send: "", back: "", step: "", followUp: "" },
};

/** The question card as the page carries it (the JSON in the element
    PAGE_IDS.questions), or the empty one when that isn't JSON or isn't a
    question card. */
function readQuestionCard(): QuestionCard {
  try {
    const data: unknown = JSON.parse(document.getElementById(PAGE_IDS.questions)?.textContent ?? "");
    return isQuestionCard(data) ? data : EMPTY_QUESTION_CARD;
  } catch {
    return EMPTY_QUESTION_CARD;
  }
}

/** The question card: its topics, and the personal answers. */
export const questionCard = readQuestionCard();
