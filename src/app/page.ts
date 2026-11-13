/* The page this runs on: the elements the script works with, and what it
   says. Each page carries its own wording and question card, so one script
   serves every language. */
import { SCRIPT_STRING_NAMES, SCRIPT_STRING_ATTRIBUTES, type ScriptStrings } from "../config/strings.ts";
import { DATA } from "../contracts/page-attributes.ts";
import { HOURS, type GreetingPart } from "../contracts/day-parts.ts";
import { PAGE_IDS } from "../contracts/page-ids.ts";
import { CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { byId, find } from "./lib/dom.ts";

/** It carries the page's language, the script's wording and where /ask is. */
export const root = document.documentElement;

function readScriptStrings(): ScriptStrings {
  const wording = SCRIPT_STRING_NAMES.map((name) => [name, root.getAttribute(SCRIPT_STRING_ATTRIBUTES[name]) ?? ""]);
  // Object.fromEntries forgets which keys it was given.
  return Object.fromEntries(wording) as ScriptStrings;
}

/** In the page's language. An optional string the page doesn't carry (for
    a part the site doesn't have) is "". */
export const words = readScriptStrings();

/** Where a typed question goes (/ask), or "" when Ask is off. */
export const askUrl = root.getAttribute(DATA.ask) ?? "";

export const sidebar = byId(PAGE_IDS.sidebar);
/** Around the sidebar, the open tab and the panel. */
export const shell = find(document, CLASS_SELECTOR.shell);
/** It holds the home screen and every tab; a chat's tab is added to it. */
export const main = byId(PAGE_IDS.main);
export const detailsPanel = byId(PAGE_IDS.panel);
/** It's the home screen's heading. */
export const homeGreeting = byId(PAGE_IDS.greeting);
/** The "Something else" tab: the reply to a question the site can't answer. */
export const askedTab = byId(PAGE_IDS.asked);

/** Whose site this is. */
export const siteName = sidebar.querySelector(CLASS_SELECTOR.wordmark)?.textContent.trim() ?? "";
/** The home screen's window title: the one the page came with. */
export const pageTitle = document.title;

/** It carries the home screen's own words. */
const homeBody = find(document, CLASS_SELECTOR.homeBody);

/** Null for a part of the day the page has no greeting for. */
function readGreetings(): Record<GreetingPart, string | null> {
  const parts = Object.keys(HOURS.greeting) as GreetingPart[];
  const greetingByPart = parts.map((part) => [part, homeBody.getAttribute(DATA.greet(part))]);
  return Object.fromEntries(greetingByPart) as Record<GreetingPart, string | null>;
}

export const greetings = readGreetings();
/** Who this is, in one line. */
export const tagline = homeBody.getAttribute(DATA.tagline);
