/* The page this runs on: the elements the script works with, and what it
   says. Each page carries its own wording and question card, so one script
   serves every language. */
import { SCRIPT_STRING_NAMES, SCRIPT_STRING_ATTRIBUTES, type ScriptStrings } from "../config/strings.ts";
import { DATA } from "../contracts/page-attributes.ts";
import { HOURS, type GreetingPart } from "../contracts/day-parts.ts";
import { PAGE_IDS } from "../contracts/page-ids.ts";
import type { QuestionCard } from "../config/question-card.ts";
import { CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { byId, find } from "./lib/dom.ts";

/** The page's <html>: it carries the page's language, the script's wording
    and where /ask is. */
export const root = document.documentElement;

/** Every script string, as its data-* attribute on <html> has it. */
function readScriptStrings(): ScriptStrings {
  const wording = SCRIPT_STRING_NAMES.map((name) => [name, root.getAttribute(SCRIPT_STRING_ATTRIBUTES[name]) ?? ""]);
  // Object.fromEntries forgets which keys it was given.
  return Object.fromEntries(wording) as ScriptStrings;
}

/** The script's wording, in the page's language. An optional string the
    page doesn't carry (for a part the site doesn't have) is "". */
export const words = readScriptStrings();

/** Where a typed question goes (/ask), or "" when Ask is off. */
export const askUrl = root.getAttribute(DATA.ask) ?? "";

/** The sidebar of tabs. */
export const side = byId(PAGE_IDS.sidebar);
/** The shell around the sidebar, the open tab and the panel. */
export const shell = find(document, CLASS_SELECTOR.shell);
/** What holds the home screen and every tab; a chat's tab is added to it. */
export const main = byId(PAGE_IDS.main);
/** The details panel on the right. */
export const detailsPanel = byId(PAGE_IDS.panel);
/** The home screen's greeting, which is its heading. */
export const homeGreeting = byId(PAGE_IDS.greeting);
/** The "Something else" tab: the reply to a question the site can't answer. */
export const askedTab = byId(PAGE_IDS.asked);

/** Whose site this is: the name at the top of the sidebar. */
export const siteName = side.querySelector(CLASS_SELECTOR.wordmark)?.textContent.trim() ?? "";
/** The window title the page came with, which is the home screen's. */
export const pageTitle = document.title;

/** The home screen under its top bar, which carries the home screen's own
    words. */
const homeBody = find(document, CLASS_SELECTOR.homeBody);

/** The greeting the page has for each part of the day (null for one it
    doesn't have). */
function readGreetings(): Record<GreetingPart, string | null> {
  const parts = Object.keys(HOURS.greeting) as GreetingPart[];
  const greetingByPart = parts.map((part) => [part, homeBody.getAttribute(DATA.greet(part))]);
  return Object.fromEntries(greetingByPart) as Record<GreetingPart, string | null>;
}

/** A greeting for each part of the day. */
export const greetings = readGreetings();
/** Who this is, in one line. */
export const tagline = homeBody.getAttribute(DATA.tagline);

/** A question's words, without the "Question:" said only to screen readers. */
export function questionText(question: Element): string {
  return [...question.childNodes]
    .filter((node) => !(node instanceof Element && node.matches(CLASS_SELECTOR.srOnly)))
    .map((node) => node.textContent)
    .join("")
    .trim();
}

/** The question card as the build wrote it into the page: its topics, and
    the personal answers. */
export const questionCard = JSON.parse(byId(PAGE_IDS.questionCardData).textContent) as QuestionCard;
