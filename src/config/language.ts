/* One language's page, in the order the page draws its parts. The home
   screen, the sidebar and "Something else" have files of their own. */

import type { Asked } from "./asked.ts";
import type { Block, FileCard } from "./blocks.ts";
import type { Home } from "./home.ts";
import type { Markdown } from "./markdown.ts";
import type { QuestionCard } from "./question-card.ts";
import type { Sidebar } from "./sidebar.ts";
import type { Strings } from "./strings.ts";

export type Language = {
  /** The language in the sidebar's language switch, short: "EN". */
  label: string;
  /** The language's own name ("English", "日本語"): what the account menu
      on another language's page calls this one. */
  name: string;
  /** For Open Graph: "en_US". */
  locale: string;
  /** Text direction ("ltr" if left out). */
  dir?: "ltr" | "rtl";
  /** What the page tells search engines and link previews. */
  meta: {
    /** In the browser's tab while no thread is open, in search results and
        link previews, and llms.txt's heading. */
    title: string;
    /** A sentence or two under the title in search results and link
        previews, and the second line of the printed page. */
    description: string;
    /** What the social card's picture shows, for anyone who can't see it. */
    imageAlt: string;
    /** Fonts the page loads up front, so its text doesn't change face as
        it loads: paths on the site (["/assets/fonts/inter.woff2"]). An
        empty list loads each font when the text first needs it. */
    preload: string[];
  };
  /** You, in this language. */
  person: {
    /** As this language writes it. Where it isn't the site's `name`, the
        printed page shows both ("アレックス (Alex Example)"), and Ask
        knows you by either. */
    name: string;
    /** For the schema.org data: "Software Engineer". */
    jobTitle: string;
  };
  /** Shown while no tab is open. */
  home: Home;
  /** The column of tabs on the left. */
  sidebar: Sidebar;
  /** The conversations: one tab each, in the order the page has them. */
  threads: Thread[];
  /** "Something else": the reply to a question the site has no answer for. */
  asked: Asked;
  /** The details panel on the right. */
  panel: Panel;
  /** The account row at the foot of the sidebar, and its menu. */
  account: Account;
  /** The topics to pick from under every thread, and the personal answers. */
  questions: QuestionCard;
  /** The 404 page. It's in the main language, but shows every language's
      `text` and `back`, each marked as its own. */
  notFound: {
    /** Its heading, and its title in the browser's tab: "Page not found."
        Only the main language's is shown. */
    title: string;
    /** A line under the heading: "There's nothing at this address." */
    text: string;
    /** The link to this language's page: "Back to the portfolio". */
    back: string;
  };
  /** The page's own wording: labels, tooltips and what the browser code
      says. */
  strings: Strings;
};

/** What a thread's, a sidebar group's or a personal answer's id looks
    like: lowercase letters, digits and dashes ("about"). */
export const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** A conversation: a tab of its own, at #id. */
export type Thread = {
  /** Its address (#about): ID_PATTERN. The sidebar, the panel, the question
      card and links in the text name the thread by it. The page uses some
      ids itself ("top", "main", "asked", anything starting "personal-",
      "chat-", "group-" or "panel-", or ending "-title"): the build says so
      if a thread takes one. */
  id: string;
  /** The tab's name, in the bar across its top and the window's title.
      Ask's model and llms.txt read the thread's answers under it. */
  title: string;
  /** A label beside the title. Leave out for none. */
  pill?: Pill;
  /** At least one. Picked in the question card in a chat, a thread is sent
      as its first question and one reply made of all its answers, so write
      each later answer to read on from the one before (not "Yes."). */
  messages: Message[];
};

export type Pill = {
  /** What it says, beside the title: "Current role". */
  label: string;
  /** true for a blue dot before it. */
  live?: boolean;
};

export type Message = {
  /** The question, as a visitor would type it: drawn as their message. */
  q: Markdown;
  /** A line between the question and the answer, as if a file had been
      read to answer it. Leave out for none. */
  read?: StatusLine;
  /** The answer, a part at a time: paragraphs, lists, cards, figures… */
  a: Block[];
};

/** "Read experience/acme.md" above an answer (the words around the file's
    name are strings.status): it opens onto a card.

        read: { file: "experience/acme.md", card: { file: "acme.yaml", lines: [["role", "Engineer"]] } } */
export type StatusLine = {
  /** The file's name in the line, in bold: "experience/acme.md". */
  file: string;
  /** The file card the line opens onto. */
  card: FileCard;
};

/** The details panel. A section left out isn't drawn; with JavaScript a
    visitor can fold and reorder them. */
export type Panel = {
  /** The career as a checklist. */
  progress?: {
    /** The section's heading: "Progress". */
    title: string;
    /** The checklist, top to bottom. */
    steps: PanelStep[];
  };
  /** Things you've made, as rows: a resume, a project. */
  outputs?: PanelList;
  /** Where else to find you, as rows. "Log out" shows these links as its
      goodbye's contact links (your email alone, without them). */
  context?: PanelList;
};

/** A step in the checklist: a tick, a title and when. */
export type PanelStep = {
  /** The id of the thread it opens. */
  tab: string;
  /** What the step says: "Senior Engineer". */
  title: string;
  /** Under the title, smaller: "Acme · 2020 – now". */
  when: string;
  /** true for the current step, which gets a blue dot in place of its tick. */
  now?: boolean;
};

export type PanelList = {
  /** The section's heading: "Outputs". */
  title: string;
  /** The section's rows, top to bottom. */
  rows: PanelRow[];
};

/** A row of the panel: an icon, a label, and a note on the right. llms.txt
    lists the rows that link somewhere (but for your contact links, which
    it has from `links`). */
export type PanelRow = {
  /** What the row says: "Resume". */
  label: string;
  /** The note on the right, smaller: "PDF". */
  meta: string;
  /** An .i-* icon (as a sidebar row's), or "github" or "linkedin", which
      are drawn as small lettered badges. */
  icon: string;
  /** Where it links: a web address, a path on the site, or #thread. One
      the config's `viewer` lists opens in the viewer. Leave out for a row
      that isn't a link. */
  href?: string;
};

/** The account row at the bottom of the sidebar, and its menu. The menu
    needs JavaScript; without it the row just shows who this is. */
export type Account = {
  /** In the round avatar: one letter, "A". */
  initial: string;
  /** Beside the avatar: your name, short ("Alex"). */
  name: string;
  /** After the name, dimmer: "· Remote". */
  sub: string;
  /** The menu's name, for screen readers: "Account". */
  label: string;
  /** Your time beside the visitor's. */
  clock: Clock;
  /** On a site with more than one language (which needs it), the menu row
      that opens the other language's page, or lists the others when there
      are several: "Language". */
  language?: string;
  /** The row that opens the thread that says how to hire you. */
  upgrade: {
    /** What the row says: "Upgrade to Pro". */
    label: string;
    /** The badge on its right: "Hire me". */
    hire: string;
    /** The id of the thread it opens. */
    tab: string;
  };
  /** The last row, and the goodbye it shows over the page. */
  logout: {
    /** What the row says: "Log out". */
    label: string;
    /** The goodbye's heading: "See you next time." */
    title: string;
    /** A line under the heading, above your contact links. */
    text: string;
    /** The button that brings the page back: "Log back in". */
    back: string;
  };
};

/** The account menu's clock: your time and the visitor's side by side,
    and under them how far apart you are and what you're likely doing. */
export type Clock = {
  /** The label over your time: "Alex, in Japan". */
  me: string;
  /** Your time zone's name ("Japan (UTC+9)"), shown in place of your time
      until the browser code sets it. */
  zone: string;
  /** The label over the visitor's time: "You". */
  you: string;
  /** When your clock is ahead of the visitor's, with {n} for the hours
      between: "{n}h ahead of you". */
  ahead: string;
  /** When your clock is behind theirs: "{n}h behind you". */
  behind: string;
  /** When both clocks read the same: "Same time as you". */
  same: string;
  /** What you're likely doing, by your own time of day. */
  moods: ClockMoods;
};

/** What the clock says you're likely doing at each part of your day (the
    hours are HOURS.mood, in src/contracts/day-parts.ts). */
export type ClockMoods = {
  /** From 5:00: "Coffee first." */
  morning: string;
  /** From 10:00: "Probably deep in a pull request." */
  day: string;
  /** From 18:00: "Probably off for the evening." */
  evening: string;
  /** From 23:00 until morning: "Probably asleep." */
  late: string;
};

export type ClockMood = keyof ClockMoods;

/** Every ClockMood, in the order of the day. */
export const CLOCK_MOODS = ["morning", "day", "evening", "late"] as const satisfies readonly ClockMood[];
