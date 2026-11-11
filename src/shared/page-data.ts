/* What the pages hand the browser code: its wording (data-* on <html>), the
   question card (JSON in <script id="questions">), and the names both find
   their way around the page by. The browser checks import it too. */

import type { ClockMood, Home, Panel } from "./config.ts";
import type { Markdown } from "./content.ts";

/** The wording the browser code shows, one data-* attribute each on
    <html> (data-copy-failed for copyFailed, and so on). */
export const SCRIPT_STRINGS = [
  "copied",
  "copyFailed",
  "menuCopy",
  "menuOptions",
  "menuRename",
  "menuFollowUp",
  "menuJump",
  "menuMore",
  "menuDelete",
  "thinking",
  "thinkingWords",
  "chats",
  "chatDeleted",
  "newChat",
  "moveSection",
  "resize",
  "askFrom",
  "askRemoved",
  "askLimited",
  "askLeft",
  // Under a reply /ask wrote: where a personal answer is from, and what
  // opens the answer itself.
  "askFromPersonal",
  "askFull",
] as const;

export type ScriptString = (typeof SCRIPT_STRINGS)[number];
export type ScriptStrings = Record<ScriptString, string>;

/** Ids the page and the browser code use themselves. */
export const PAGE_IDS = {
  top: "top",
  tabs: "tabs",
  main: "main",
  details: "details",
  hello: "hello",
  asked: "asked",
  questions: "questions",
  accountMenu: "account-menu",
  titleMenu: "title-menu",
  rowMenu: "row-menu",
  followUp: "follow-up",
  byeTitle: "bye-title",
} as const;

/** A choice in the question card that opens a thread. */
export type Choice = {
  /** The thread's id. */
  tab: string;
  /** Leave out to use the thread's name in the sidebar. */
  label?: string;
  /** Leave out to use the row's second line in the sidebar. */
  hint?: string;
};

/** A topic in the question card: it opens a thread (`tab`), or asks a
    second question (`ask`) and lists `choices` (or the personal answers,
    with `personal`). */
export type Topic = {
  label: string;
  hint?: string;
  tab?: string;
  ask?: string;
  choices?: Choice[];
  personal?: boolean;
};

/** An answer that isn't in a thread. Each gets its own tab. Hidden ones
    aren't in the card, but /ask can pick them. */
export type PersonalAnswer = {
  id: string;
  q: string;
  /** Paragraphs, or lists of lines. */
  a: Array<Markdown | Markdown[]>;
  /** The tab's name (the question, if left out). */
  title?: string;
  hint?: string;
  hidden?: boolean;
};

/** The question card's own wording. */
export type QuestionCardWords = {
  else: string;
  elseLabel: string;
  send: string;
  back: string;
  /** "{n} of {total}" */
  step: string;
  followUp: string;
};

/** The question card, as site.config.ts has it and the page carries it. */
export type QuestionCard = {
  /** The card's question. */
  ask: string;
  topics: Topic[];
  personal: PersonalAnswer[];
  ui: QuestionCardWords;
};

/** The data-* attribute for a script string: copyFailed → copy-failed. */
export const dataAttribute = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// ---- Names the page and the browser code agree on ------------------------------
// The components write these into the page (src/components), the browser code
// finds them there or makes more of them (src/app), and the browser checks
// look for them (tests/browser).

/** The data-* attributes, as the page has them. */
export const DATA = {
  /** On <html>: where /ask is, when Ask is on. */
  ask: "data-ask",
  /** Around the home screen's greeting: one for each part of the visitor's
      day (HOURS.greeting), and who this is, in one line. */
  greet: (part: GreetingPart) => `data-greet-${part}` as const,
  tagline: "data-tagline",
  /** On a question to start with, on the home screen: the answer it gets
      ("work.2"). */
  prompt: "data-prompt",
  /** The buttons that hide the sidebar, and show or hide the panel. */
  sideToggle: "data-side-toggle",
  panelToggle: "data-panel-toggle",
  /** The share button in a top bar, and the copy icon under an answer. */
  copyLink: "data-copy-link",
  /** On a language's link in the sidebar: the language's name, in itself. */
  name: "data-name",
  /** On a chat's tab (the browser code makes chats): the chat's id. The
      stylesheet looks for it too. */
  chat: "data-chat",
  /** On a menu row: the letter that picks it (MENU_KEYS). */
  key: "data-key",
  /** The account menu's clock, and its wording: how far apart you are, and
      a mood for each part of your day (HOURS.mood). */
  clock: "data-clock",
  same: "data-same",
  ahead: "data-ahead",
  behind: "data-behind",
  mood: (mood: ClockMood) => `data-mood-${mood}` as const,
  /** A time in the clock: your time zone, or LOCAL_ZONE. */
  zone: "data-zone",
  /** The account menu's link to the other language's page. */
  langLink: "data-lang-link",
  /** "Log out", and the goodbye's wording. */
  logout: "data-logout",
  byeTitle: "data-bye-title",
  byeText: "data-bye-text",
  byeBack: "data-bye-back",
  /** In "Something else": the email link, with the email's subject and body
      (before the question is put in), and the LinkedIn message to copy (its
      text, and its copy button). */
  mail: "data-mail",
  subject: "data-subject",
  draft: "data-draft",
  copyDraft: "data-copy-draft",
} as const;

/** The classes of the page's parts that the browser code finds (or makes
    more of) and the browser checks look for. The stylesheet has the rest. */
export const PAGE_CLASSES = {
  /** "Skip to content", first in the page, and what's printed first. */
  skip: "skip",
  printHead: "print-head",
  /** Every tab (an <article> for each thread, and each chat): its title, the
      part that scrolls, and its thread. */
  tab: "tab",
  title: "title",
  scroll: "scroll",
  thread: "thread",
  /** The chevron drawn after a tab's title without JavaScript. */
  iconAfter: "ic-after",
  /** In a thread: each question, "Question: " said to screen readers before
      it, and the answer after it. */
  question: "q",
  srOnly: "sr",
  answer: "a",
  /** A thread's "Read …" line, which opens onto the file it read. */
  status: "status",
  /** The buttons under a thread's last answer, and the composer under it. */
  messageActions: "msg-actions",
  composer: "composer",
  /** On the home screen: the box to type a question in (its input, and the
      button that sends it), and the questions to start with under it. */
  intro: "intro",
  homeAsk: "home-ask",
  homeSend: "send",
  prompts: "prompts",
  /** A figure in an answer: bars, a flow or a picture. */
  figure: "fig",
  /** A top bar's button that opens the drawer, and the share button's words. */
  menu: "menu",
  label: "label",
  /** The sidebar: the name at the top, the phone drawer's close button, its
      rows ("New tab" first), each group of tabs, its rows' two lines, and
      the other languages' links. */
  wordmark: "wordmark",
  drawerClose: "close",
  nav: "nav",
  newTab: "new",
  group: "group",
  tabs: "tabs",
  rowName: "t",
  rowHint: "s",
  lang: "lang",
  /** Around the account row (which opens the account menu); the menu's email
      row, and the clock's note. */
  account: "account",
  me: "me",
  mailRow: "pop-mail",
  clockNote: "clock-note",
  /** What's on the right of a row in a menu or the panel ("Link"). */
  rowMeta: "meta",
  /** In "Something else": the question it answers, the LinkedIn message to
      copy, and its text. */
  askedQuestion: "q-text",
  draft: "draft",
  draftText: "draft-text",
} as const;

/** How the ids the browser code makes up start, and the ids of the
    sidebar's groups and the panel's sections: no thread can take one. */
export const ID_PREFIX = {
  personal: "personal-",
  chat: "chat-",
  group: "group-",
  panel: "panel-",
} as const;

/** A tab title's id, which names the tab: titleId("about") is "about-title". */
export const titleId = (id: string): string => `${id}-title`;

/** Every ID_PREFIX, for the build to keep threads off. */
export const ID_PREFIXES = Object.values(ID_PREFIX);

/** A sidebar group's id: groupId("work") is "group-work". */
export const groupId = (id: string): string => `${ID_PREFIX.group}${id}`;

/** A panel section's id: panelId("context") is "panel-context". */
export const panelId = (key: keyof Panel): string => `${ID_PREFIX.panel}${key}`;

/** A personal answer's tab: personalTab("food") is "personal-food". */
export const personalTab = (id: string): string => `${ID_PREFIX.personal}${id}`;

/** The sidebar group the browser code adds for the visitor's chats. No group
    in the config can have its id. */
export const CHATS_GROUP = "chats";

/** In the clock, the time that's the visitor's own: data-zone="local". */
export const LOCAL_ZONE = "local";

/** The letters that pick the rows of a thread's menus. */
export const MENU_KEYS = { rename: "r", copyLink: "c", delete: "d" } as const;

/** What joins a tab's name and the site's in the window title, and the
    clock's two notes. */
export const SEPARATOR = " · ";

/** The hour (0–23) each part of the day starts at: in the visitor's time
    for the home screen's greeting, and in the owner's for the clock's mood.
    "Late" runs to the next morning. */
export const HOURS = {
  greeting: { morning: 5, afternoon: 12, evening: 18, late: 23 },
  mood: { morning: 5, day: 10, evening: 18, late: 23 },
} as const satisfies {
  greeting: Record<Exclude<keyof Home["greeting"], "default">, number>;
  mood: Record<ClockMood, number>;
};

/** A part of the visitor's day that has a greeting of its own. */
export type GreetingPart = keyof typeof HOURS.greeting;

/** The part of the day `hour` is in, by the hour each part starts (one of
    HOURS). Before the first, it's still the last. */
export function partOfDay<Part extends string>(hour: number, starts: Record<Part, number>): Part {
  const parts = (Object.keys(starts) as Part[]).sort((a, b) => starts[a] - starts[b]);
  return parts.findLast((part) => starts[part] <= hour) ?? (parts.at(-1) as Part);
}
