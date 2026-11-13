/* What the pages hand the browser code, and the names all sides find their
   way around the page by. Three sides import this file and have to agree:

   - the components (src/components) write these names into the page;
   - the browser code (src/app) finds them there (most through SELECTOR in
     src/app/constants.ts), and reads its wording and the question card
     from the page (src/app/page.ts);
   - the browser checks (tests/browser) look for the same names (as
     selectors: ID and CLASS in tests/browser/site.ts).

   In this order:

   1. The script's wording   SCRIPT_STRINGS, OPTIONAL_SCRIPT_STRINGS: a data-* attribute each on <html>
   2. The question card      QuestionCard: JSON in <script id="questions">
   3. Ids                    PAGE_IDS
   4. data-* attributes      dataAttribute (for the wording), DATA (all the others)
   5. Classes                PAGE_CLASSES
   6. Ids made from others   ID_PREFIX, titleId, groupId, panelId, personalTab
   7. Values with a meaning  CHATS_GROUP, LOCAL_ZONE, MENU_KEYS, SEPARATOR, REDUCED_MOTION
   8. The parts of the day   HOURS, partOfDay

   The values are part of the built page. The stylesheet (src/styles) has
   the ids and classes typed out, as it can't import them: change one here,
   and change it there. A class only the stylesheet needs isn't here: it's
   written where its element is. */

import type { ClockMood, Greeting, Panel } from "./config.ts";
import type { Markdown } from "./content.ts";

// ---- 1. The script's wording ---------------------------------------------------
// Each language's `strings` (config.ts) has these. Portfolio.astro writes
// each as a data-* attribute on <html>, and src/app/page.ts reads them back
// as `words`, so one script serves every language.

/** The wording the browser code shows, one data-* attribute each on
    <html> (data-copy-failed for copyFailed, and so on). */
export const SCRIPT_STRINGS = [
  // A toast, and for a moment the share button's own words, after a link or
  // a message is copied ("Copied"), or couldn't be ("Couldn't copy").
  "copied",
  "copyFailed",
  // A thread's menu, under the chevron beside its title: its "Copy link"
  // row.
  "menuCopy",
  // What screen readers call that menu and the shorter one on a sidebar
  // row, and the chevron's tooltip: "Thread options".
  "menuOptions",
  // Its "Rename" row, and the tooltip on a tab's title, which renames too.
  "menuRename",
  // Its "Ask a follow-up" row, which opens the question card.
  "menuFollowUp",
  // Its "Jump to" row, which lists the thread's questions.
  "menuJump",
  // The "…" on a sidebar row, which opens the shorter menu: "More options".
  "menuMore",
  // The "Delete" row a chat has in both menus.
  "menuDelete",
  // While a reply is on its way: what screen readers hear ("Thinking…"),
  // and the words one is picked from to show beside the seconds it's taken,
  // with "|" between them ("Thinking|Pondering|Mulling").
  "thinking",
  "thinkingWords",
  // The heading of the sidebar group the visitor's chats are listed under
  // ("Chats"), and the toast when one is deleted ("Chat deleted").
  "chats",
  "chatDeleted",
  // A chat's name until something is asked in it: "New chat".
  "newChat",
  // The grip that drags a section of the details panel, with {name} for
  // the section's heading: "Move {name}".
  "moveSection",
  // The sidebar's edge, which drags to resize it: "Resize the tabs".
  "resize",
  // Under an answer picked for a typed question, with {tab} for the name
  // of the tab it's from, as a link: "From the {tab} tab".
  "askFrom",
  // What replaces a question /ask found inappropriate: "Question removed".
  "askRemoved",
  // The reply past a visitor's questions for the day, with {limit} for how
  // many that is (Markdown, so it can link to a tab), and the note under a
  // reply when only {n} are left.
  "askLimited",
  "askLeft",
  // Under a reply /ask sent: where a personal answer is from.
  "askFromPersonal",
] as const;

/** The name of one of SCRIPT_STRINGS. */
export type ScriptString = (typeof SCRIPT_STRINGS)[number];

/** Wording for the parts only some sites have. A site needs one of these
    only when it has the part (src/site/validate.ts says which are missing),
    and its page carries the ones it has, as it does SCRIPT_STRINGS. */
export const OPTIONAL_SCRIPT_STRINGS = [
  // The viewer (the config's `viewer`): its two buttons, "Open in a new
  // tab" and "Close".
  "viewerOpen",
  "viewerClose",
  // A picture a visitor plays (an `image` with a `still`, whose file says
  // how long it plays): its button, "Play" and, while it plays, "Pause".
  "play",
  "pause",
] as const;

/** The name of one of OPTIONAL_SCRIPT_STRINGS. */
export type OptionalScriptString = (typeof OPTIONAL_SCRIPT_STRINGS)[number];

/** The optional script strings each part needs. */
export const PART_STRINGS = {
  viewer: ["viewerOpen", "viewerClose"],
  movingPictures: ["play", "pause"],
} as const satisfies Record<string, readonly OptionalScriptString[]>;

/** Every script string a page can carry. */
export const ALL_SCRIPT_STRINGS = [...SCRIPT_STRINGS, ...OPTIONAL_SCRIPT_STRINGS] as const;

/** The script's wording as it reads it from the page: an optional string
    the page doesn't carry is "". */
export type ScriptStrings = Record<ScriptString | OptionalScriptString, string>;

// ---- 2. The question card ------------------------------------------------------
// Each language's `questions` in site.config.ts is a QuestionCard.
// Portfolio.astro writes it into the page as JSON, and src/app/page.ts
// checks it field by field before the browser code builds the card from
// it: a field added here needs its check there.
//
//     questions: {
//       ask: "What would you like to know?",
//       topics: [
//         { label: "About me", tab: "about" },
//         { label: "My work", ask: "Which job?", choices: [{ tab: "acme" }, { tab: "initech" }] },
//         { label: "Something personal", ask: "Such as?", personal: true },
//       ],
//       personal: [{ id: "food", q: "what's your favorite food?", a: ["**Ramen**, of course."] }],
//       ui: { … },
//     }

/** The question card, as site.config.ts has it and the page carries it:
    the card over the composer of every tab, which needs JavaScript. */
export type QuestionCard = {
  /** The card's question, and what the home screen's box asks: "What would
      you like to know?" */
  ask: string;
  /** The choices under it, in order. Four or fewer read best (the build
      says so past that): group the rest under a topic with `choices`. */
  topics: Topic[];
  /** The answers that aren't in a thread. With none, leave the list empty. */
  personal: PersonalAnswer[];
  /** The card's own wording. */
  ui: QuestionCardWords;
};

/** A topic in the question card: it opens a thread (`tab`), or asks a
    second question (`ask`) and lists `choices` (or the personal answers,
    with `personal`). */
export type Topic = {
  /** What the choice says: "My work". */
  label: string;
  /** A line under the label. Left out, it's the thread's first question
      (with `tab`), or the names of what the topic lists. */
  hint?: string;
  /** The id of the thread the topic opens. Leave out for a topic that
      lists choices. */
  tab?: string;
  /** The second question, over the choices: "Which job?" A topic without
      a `tab` needs one. */
  ask?: string;
  /** The threads to choose from, as the topic's second step. */
  choices?: Choice[];
  /** true for the topic that lists the personal answers (but for the
      hidden ones) as its second step. */
  personal?: boolean;
};

/** A choice in the question card that opens a thread. */
export type Choice = {
  /** The thread's id. */
  tab: string;
  /** Leave out to use the thread's name in the sidebar. */
  label?: string;
  /** Leave out to use the row's second line in the sidebar. */
  hint?: string;
};

/** An answer that isn't in a thread. Each gets its own tab. Hidden ones
    aren't in the card, but /ask can pick them. */
export type PersonalAnswer = {
  /** Its own id (an ID, as a thread's): "food". Its tab is at
      #personal-food, and /ask names its answer "personal-food.1". */
  id: string;
  /** The question, as a visitor would type it: what the card lists it by,
      and the message its tab shows. */
  q: string;
  /** Paragraphs, or lists of lines. */
  a: Array<Markdown | Markdown[]>;
  /** The tab's name (the question, if left out). */
  title?: string;
  /** A line under the question in the card (the question again, if left
      out). */
  hint?: string;
  /** true to keep it out of the card. It still has its tab, Ask can pick
      it for a typed question, and a question to start with on the home
      screen can name it. Keep those to things that won't go out of date. */
  hidden?: boolean;
};

/** The question card's own wording. */
export type QuestionCardWords = {
  /** The placeholder of the box for a question of the visitor's own: "Ask
      your own question". */
  else: string;
  /** That box's name, for screen readers. */
  elseLabel: string;
  /** The button that sends it, and the home screen's: "Ask". */
  send: string;
  /** The button that goes from a topic's choices back to the topics:
      "Back". */
  back: string;
  /** Beside that button, which step of the card this is: "{n} of {total}". */
  step: string;
  /** The card's name, for screen readers: "Ask a follow-up". */
  followUp: string;
};

// ---- 3. Ids --------------------------------------------------------------------

/** Ids the page and the browser code use themselves. No thread can take
    one (src/site/validate.ts), since a thread's id is its tab's. */
export const PAGE_IDS = {
  /** The home screen. A link to #top closes the open tab, since the home
      screen shows whenever no tab is the address's target: the drawer's
      close button and the composer under every tab are such links. */
  top: "top",
  /** The sidebar. A top bar's menu button links to #tabs, which opens the
      sidebar as a drawer on a phone, without JavaScript too. */
  tabs: "tabs",
  /** The <main> every tab is in: where "Skip to content" goes. */
  main: "main",
  /** The details panel: what its toggles say they control. */
  details: "details",
  /** The home screen's greeting, which the browser code rewrites for the
      visitor's time of day. */
  hello: "hello",
  /** The "Something else" tab. The browser code copies it for that reply,
      and for each personal answer's tab. */
  asked: "asked",
  /** The <script> that holds the question card's JSON. */
  questions: "questions",
  /** The account menu, which the account row opens. */
  accountMenu: "account-menu",
  /** Not in the built page; the browser code makes it: a thread's menu,
      under the chevron beside its title. */
  titleMenu: "title-menu",
  /** Made by the browser code: the shorter menu on a thread's sidebar row. */
  rowMenu: "row-menu",
  /** Made by the browser code: the question card. */
  followUp: "follow-up",
  /** Made by the browser code: the heading of the goodbye "Log out" shows. */
  byeTitle: "bye-title",
} as const;

// ---- 4. data-* attributes ------------------------------------------------------
// The components write these into the page (src/components), the browser code
// finds them there or makes more of them (src/app), and the browser checks
// look for them (tests/browser).

/** The data-* attribute for a script string: copyFailed → copy-failed
    (each capital becomes a dash and its small letter). */
export const dataAttribute = (key: string): string => key.replace(/[A-Z]/g, (capital) => `-${capital.toLowerCase()}`);

/** The data-* attributes, as the page has them. Each comment says which
    element has it and what its value is. One with no value only marks its
    element for the browser code to find: a component writes it with `flag`
    (src/components/attributes.ts). */
export const DATA = {
  /** On <html>: where /ask is, when Ask is on. A page without it sends no
      question anywhere. */
  ask: "data-ask",
  /** Around the home screen's greeting: the greeting for each part of the
      visitor's day (HOURS.greeting), as data-greet-morning and so on. The
      browser code shows the one for the hour. */
  greet: (part: GreetingPart) => `data-greet-${part}` as const,
  /** On the same element: who this is, in one line (the config's
      home.tagline). A new chat shows it under your name. */
  tagline: "data-tagline",
  /** On a question to start with, on the home screen: the answer it gets
      ("work.2"). */
  prompt: "data-prompt",
  /** No value. Marks the button in the sidebar that hides the sidebar. */
  sideToggle: "data-side-toggle",
  /** No value. Marks each button that shows or hides the details panel:
      the one in every top bar, and the panel's own close button. */
  panelToggle: "data-panel-toggle",
  /** No value. Marks the share button in a tab's top bar, and the copy
      icon under an answer: both copy the tab's address. */
  copyLink: "data-copy-link",
  /** On a language's link in the sidebar: the language's name, in itself. */
  name: "data-name",
  /** On a chat's tab (the browser code makes chats): the chat's id. The
      stylesheet looks for it too. */
  chat: "data-chat",
  /** On a menu row: the letter that picks it (MENU_KEYS). */
  key: "data-key",
  /** No value. Marks the account menu's clock, which also has the next
      four: the wording the browser code writes the clock's note from. */
  clock: "data-clock",
  /** On the clock: what it says when your time and the visitor's are the
      same. */
  same: "data-same",
  /** On the clock: what it says when your time is ahead of the visitor's,
      with {n} for the hours between. */
  ahead: "data-ahead",
  /** On the clock: what it says when your time is behind theirs. */
  behind: "data-behind",
  /** On the clock: what you're likely doing at each part of your day
      (HOURS.mood), as data-mood-morning and so on. */
  mood: (mood: ClockMood) => `data-mood-${mood}` as const,
  /** A time in the clock: your time zone, or LOCAL_ZONE. */
  zone: "data-zone",
  /** No value. Marks the account menu's link to the other language's page. */
  langLink: "data-lang-link",
  /** No value. Marks "Log out" in the account menu, which also has the
      next three: the wording of the goodbye it shows. */
  logout: "data-logout",
  /** On "Log out": the goodbye's heading. */
  byeTitle: "data-bye-title",
  /** On "Log out": the goodbye's line of text. */
  byeText: "data-bye-text",
  /** On "Log out": the label of the button that brings the page back. */
  byeBack: "data-bye-back",
  /** In "Something else", on the link that opens an email: the email's
      body as the config has it, before the question is put in. It is also
      how the browser code finds the link. */
  mail: "data-mail",
  /** On the same link: the email's subject. */
  subject: "data-subject",
  /** In "Something else", around the LinkedIn message to copy: its text as
      the config has it, before the question is put in. */
  draft: "data-draft",
  /** No value. Marks that message's copy button. */
  copyDraft: "data-copy-draft",
  /** On a link that opens in the viewer (the config's `viewer`): the
      address the viewer shows in its frame. */
  view: "data-view",
  /** On the same link: what the viewer calls what it shows. */
  viewTitle: "data-view-title",
  /** On the Play button of a picture a visitor plays (a link to the
      picture as it moves, which is where it goes without JavaScript): how
      many seconds it plays, as the picture's own file says. */
  play: "data-play",
} as const;

// ---- 5. Classes ----------------------------------------------------------------

/** The classes of the page's parts that the browser code finds (or makes
    more of) and the browser checks look for. The stylesheet has the rest.
    Each comment says which element has the class. To see every side that
    counts on one, search for its name here (`PAGE_CLASSES.wordmark`), then
    for the selector made from it (`SELECTOR.wordmark` in src/app,
    `CLASS.wordmark` in tests/browser). */
export const PAGE_CLASSES = {
  /** "Skip to content", the first link in the page. */
  skip: "skip",
  /** Who this is and how to reach them, which only shows printed. */
  printHead: "print-head",
  /** Every tab: an <article> for each thread, and for each chat the
      browser code makes. */
  tab: "tab",
  /** A tab's title, in the bar across its top. */
  title: "title",
  /** The part of a tab that scrolls. */
  scroll: "scroll",
  /** A tab's conversation, inside the part that scrolls: its questions
      and answers are this element's children. */
  thread: "thread",
  /** On a tab's title: draws a chevron after it. The browser code takes
      the class off, and puts a real button there for the thread's menu. */
  iconAfter: "ic-after",
  /** A question in a thread: a visitor's message. */
  question: "q",
  /** Text only screen readers get, such as "Question: " before each
      question. */
  srOnly: "sr",
  /** An answer in a thread: what follows a question. */
  answer: "a",
  /** A thread's "Read …" line, which opens onto the file it read. */
  status: "status",
  /** The buttons under a thread's last answer. */
  messageActions: "msg-actions",
  /** A composer: the link under every tab that opens the question card,
      and the box around the home screen's input. */
  composer: "composer",
  /** On the home screen: the line about you. The browser code draws a new
      chat's tagline and the goodbye's text the same way. */
  intro: "intro",
  /** On the home screen: around the box to type a question in and the
      questions to start with. */
  homeAsk: "home-ask",
  /** The button that sends what's typed in that box. */
  homeSend: "send",
  /** The list of questions to start with. */
  prompts: "prompts",
  /** A figure in an answer: bars, a flow or a picture. */
  figure: "fig",
  /** A figure whose picture a visitor plays; in it, what holds the picture
      with its button over it; and the button. */
  plays: "plays",
  stage: "stage",
  playButton: "play",
  /** Someone else's words in an answer, with who said them. */
  quote: "quote",
  /** A file card: a small config file's lines under its name. */
  fileCard: "card",
  /** A top bar's button that opens the sidebar as a drawer on a phone, or
      brings it back once it's hidden. */
  menu: "menu",
  /** A button's words, in an element of their own, so a narrow screen can
      show its icon alone and keep its name: the share button's, which say
      "Copied" for a moment, and a played picture's "Play" and "Pause". */
  label: "label",
  /** In the sidebar: your name at the top. The browser code reads the
      site's name from it. */
  wordmark: "wordmark",
  /** In the sidebar: the button that closes it when it's a drawer. */
  drawerClose: "close",
  /** In the sidebar: the list of rows at the top, "New tab" first. */
  nav: "nav",
  /** In that list: the "New tab" row. */
  newTab: "new",
  /** In the sidebar: a group's heading. The browser code makes one more,
      for the visitor's chats. */
  group: "group",
  /** In the sidebar: the list of a group's rows. */
  tabs: "tabs",
  /** In a group's row: its first line, the tab's name. */
  rowName: "t",
  /** In a group's row: its second line. */
  rowHint: "s",
  /** In the sidebar: around the links to the other languages' pages. */
  lang: "lang",
  /** Around the account row and its menu, at the foot of the sidebar. */
  account: "account",
  /** The account row itself, which opens the account menu. */
  me: "me",
  /** In the account menu: the row with your email address. */
  mailRow: "pop-mail",
  /** In the account menu: the line under the clock's two times, which the
      browser code writes. */
  clockNote: "clock-note",
  /** What's on the right of a row in a menu or the panel ("Link"). */
  rowMeta: "meta",
  /** In "Something else": the words of the question it answers. */
  askedQuestion: "q-text",
  /** In "Something else": around the LinkedIn message to copy. */
  draft: "draft",
  /** In "Something else": that message's text. */
  draftText: "draft-text",
} as const;

// ---- 6. Ids made from others ---------------------------------------------------

/** How the ids the browser code makes up start, and the ids of the
    sidebar's groups and the panel's sections: no thread can take one. */
export const ID_PREFIX = {
  /** A personal answer's tab: "personal-food". */
  personal: "personal-",
  /** A visitor's chat's tab: "chat-" and a number made from the time it
      was started. */
  chat: "chat-",
  /** A sidebar group's heading: "group-work". */
  group: "group-",
  /** A panel section's heading: "panel-context". */
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

// ---- 7. Values with a meaning --------------------------------------------------

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

/** The media query that's true for a visitor whose computer asks for less
    motion: a picture that moves shows its still to them (Picture.astro),
    and the script moves nothing (src/app/lib/motion.ts). The stylesheet
    has it typed out. */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

// ---- 8. The parts of the day ---------------------------------------------------

/** The hour (0–23) each part of the day starts at: in the visitor's time
    for the home screen's greeting, and in the owner's for the clock's mood.
    "Late" runs to the next morning. */
export const HOURS = {
  greeting: { morning: 5, afternoon: 12, evening: 18, late: 23 },
  mood: { morning: 5, day: 10, evening: 18, late: 23 },
} as const satisfies {
  greeting: Record<Exclude<keyof Greeting, "default">, number>;
  mood: Record<ClockMood, number>;
};

/** A part of the visitor's day that has a greeting of its own. */
export type GreetingPart = keyof typeof HOURS.greeting;

/** The part of the day `hour` is in, by the hour each part starts (one of
    HOURS). Before the first, it's still the last: with HOURS.greeting, 4
    is "late" and 5 is "morning". */
export function partOfDay<Part extends string>(hour: number, starts: Record<Part, number>): Part {
  const partsFromEarliest = (Object.keys(starts) as Part[]).sort((one, other) => starts[one] - starts[other]);
  return partsFromEarliest.findLast((part) => starts[part] <= hour) ?? (partsFromEarliest.at(-1) as Part);
}
