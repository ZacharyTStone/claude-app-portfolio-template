/* One language's page, as site.config.ts has it: Language, then its parts
   in the order the page draws them: Home, Sidebar, Thread, Asked, Panel,
   Account. The whole site is in site-config.ts. */

import type { Block, Card } from "./blocks.ts";
import type { Markdown } from "./markdown.ts";
import type { QuestionCard } from "./question-card.ts";
import type { Strings } from "./strings.ts";

/** Everything one language's page says. */
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
    /** The page's title: in the browser's tab while no thread is open, in
        search results and link previews, and llms.txt's heading. */
    title: string;
    /** A sentence or two under the title in search results and link
        previews, and the second line of the printed page. */
    description: string;
    /** The social card's alt text: what the picture shows. */
    imageAlt: string;
    /** Fonts the page loads up front, so its text doesn't change face as
        it loads: paths on the site (["/assets/fonts/inter.woff2"]). An
        empty list loads each font when the text first needs it. */
    preload: string[];
  };
  /** You, in this language. */
  person: {
    /** Your name as this language writes it. Where it isn't the site's
        `name`, the printed page shows both ("アレックス (Alex Example)"),
        and Ask knows you by either. */
    name: string;
    /** Your job title, for the schema.org data: "Software Engineer". */
    jobTitle: string;
  };
  /** The home screen, shown while no tab is open. */
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
  /** The question card: the topics to pick from under every thread, and
      the personal answers (question-card.ts has its shape). */
  questions: QuestionCard;
  /** The 404 page. It's in the main language, but shows every language's
      `text` and `back`, each marked as its own. */
  notFound: {
    /** Its heading, and its title in the browser's tab: "Page not found."
        Only the main language's is shown. */
    title: string;
    /** A line under it: "There's nothing at this address." */
    text: string;
    /** The label of the link to this language's page: "Back to the
        portfolio". */
    back: string;
  };
  /** The page's own wording: labels, tooltips and what the browser code
      says. */
  strings: Strings;
};

// ---- The home screen -----------------------------------------------------------

/** The home screen. */
export type Home = {
  /** The heading. */
  greeting: Greeting;
  /** Under the greeting: a line or so, as the home screen is meant to be
      light. */
  intro: Markdown;
  /** Its own line under the intro, after an arrow pointing at the tabs
      (not on phones, where the tabs are a drawer). Leave out for none. */
  hint?: string;
  /** One line under your name at the top of a new chat, which is where a
      visit starts on a phone. Leave out for the name alone. */
  tagline?: string;
  /** Questions to start with, under the box to type in on the home screen
      (which needs JavaScript, as they do): a few, each short enough for
      one line. Leave out for the box alone. */
  prompts?: Prompt[];
};

/** The home screen's heading, by the visitor's time of day. The page is
    built with `default`, which is what shows without JavaScript; the
    browser code swaps in the one for the hour: `morning` from 5:00,
    `afternoon` from 12:00, `evening` from 18:00 and `late` from 23:00
    (HOURS.greeting, in src/contracts/day-parts.ts). */
export type Greeting = { default: string; morning: string; afternoon: string; evening: string; late: string };

/** A question to start with: choosing it opens a new chat and sends `q`,
    and the reply is the answer `answer` names, word for word, as /ask
    names them: "work.2" is the second answer in the thread "work", and
    "personal-food.1" the personal answer "food". */
export type Prompt = { q: string; answer: string };

// ---- The sidebar ---------------------------------------------------------------

/** The sidebar: under your name, "New tab" and a few rows with icons, then
    groups of tabs under headings. A thread no row links to can still be
    opened by its address, and by the question card. */
export type Sidebar = {
  /** The first row's label: "New tab". It's a link to the home screen;
      with JavaScript it starts a new chat. */
  newTab: string;
  /** The rows under it, each a thread with an icon ("About", "Skills"). */
  nav: SidebarNavRow[];
  /** The groups of tabs under those, each under its heading. */
  groups: SidebarGroup[];
};

/** A row at the top of the sidebar: an icon and a label. */
export type SidebarNavRow = {
  /** The id of the thread it opens. */
  tab: string;
  /** Its icon: one of the .i-* classes in src/styles, by its name without
      the "i-". "about", "skills", "file", "contact", "work" and "globe"
      are the ones drawn for content. */
  icon: string;
  /** What the row says: "About". */
  label: string;
};

/** Rows under a heading ("Work history"), below the ones at the top. With
    JavaScript the heading folds its rows away. */
export type SidebarGroup = {
  /** The group's own id (an ID, like a thread's): the page remembers by
      it which groups a visitor folded. Each group's is different, and none
      is "chats", the group the browser code adds for the visitor's chats. */
  id: string;
  /** The heading: "Work history". */
  label: string;
  /** Its rows. */
  tabs: SidebarRow[];
};

/** A row in a sidebar group: two lines, a name over a note. */
export type SidebarRow = {
  /** The id of the thread it opens. */
  tab: string;
  /** The first line: "Acme". The question card names the thread by it,
      unless its choice has a `label`. */
  title: string;
  /** The second line, smaller: "Senior Engineer · 2020 – now". The
      question card uses it as a choice's hint, unless the choice has one. */
  subtitle: string;
  /** Shows a blue dot after the title, with this as its tooltip ("Current
      role"). Leave out for no dot. */
  live?: string;
};

// ---- The conversations ---------------------------------------------------------

/** What a thread's, a sidebar group's or a personal answer's id looks
    like: lowercase letters, digits and dashes ("about"). */
export const ID = /^[a-z][a-z0-9-]*$/;

/** A conversation: a tab of its own, at #id. */
export type Thread = {
  /** Its address (#about): an ID. The sidebar, the panel, the question
      card and links in the text name the thread by it. The page uses some
      ids itself (such as "top", "main" and "asked", and anything starting
      "personal-", "chat-", "group-" or "panel-", or ending "-title"): the
      build says so if a thread takes one. */
  id: string;
  /** The tab's name, in the bar across its top and the window's title.
      Ask's model and llms.txt read the thread's answers under it. */
  title: string;
  /** A label beside the title. Leave out for none. */
  pill?: Pill;
  /** Picked in the question card in a chat, a thread is sent as its first
      question and one reply made of all its answers, without the later
      questions: write each later answer to read on from the one before
      (not "Yes."). At least one. */
  messages: Message[];
};

/** A label beside a thread's title in the top bar ("Current role"), with a
    blue dot if `live`. */
export type Pill = { label: string; live?: boolean };

/** A question and its answer. */
export type Message = {
  /** The question, as a visitor would type it: drawn as their message. */
  q: Markdown;
  /** A line between the question and the answer, as if a file had been
      read to answer it. Leave out for none. */
  read?: StatusLine;
  /** The answer, a part at a time: paragraphs, lists, cards, figures…
      (blocks.ts's Block). */
  a: Block[];
};

/** "Read experience/acme.md" above an answer (the words around the file's
    name are strings.status): it opens onto a card.

        read: { file: "experience/acme.md", card: { file: "acme.yaml", lines: [["role", "Engineer"]] } } */
export type StatusLine = {
  /** The file's name in the line, in bold: "experience/acme.md". */
  file: string;
  /** The file card the line opens onto. */
  card: Card;
};

// ---- "Something else" ----------------------------------------------------------

/** "Something else": the reply to a question the site has no answer for,
    with ways to ask you instead. In `email` and `message.text`,
    {question} is what the visitor asked. On an English page Ask says it to
    you where it can ("Do you…?" for "Does Alex…?"). Where it can't, on a
    page in another language and with Ask off, it's the question as they
    typed it, which is about you, not to you ("Does Alex…?"); and for a
    visitor who's been blocked it's nothing at all. So give it a line of
    its own ("A question from your portfolio:", then {question}) rather
    than a place in a sentence. */
export type Asked = {
  /** The tab's name: "Something else". */
  title: string;
  /** The question it shows without JavaScript, and puts in the email and
      the message until a visitor asks their own: a sample. */
  q: string;
  /** The reply's paragraph, above the ways to reach you. */
  answer: Markdown;
  /** The label of the link that opens the email: "Email it to me". */
  mail: string;
  /** The email's subject line. */
  subject: string;
  /** The email's body, with {question} where the question goes (the build
      checks it's there). */
  email: string;
  /** With links.linkedin: the label of the link to your profile. */
  linkedin?: string;
  /** With links.linkedin: a message for the visitor to copy and send you
      there. */
  message?: {
    /** The heading over the message: "A message to copy". */
    label: string;
    /** The message, with {question} where the question goes. */
    text: string;
    /** The copy button's label and tooltip: "Copy message". */
    copy: string;
  };
};

// ---- The details panel ---------------------------------------------------------

/** The details panel on the right. Each section is optional, and left out
    isn't drawn; with JavaScript a visitor can fold and reorder them. */
export type Panel = {
  /** The career as a checklist. */
  progress?: {
    /** The section's heading: "Progress". */
    title: string;
    steps: PanelStep[];
  };
  /** Things you've made, as rows: a resume, a project. */
  outputs?: PanelList;
  /** Where else to find you, as rows. "Log out" shows these links as its
      goodbye's contact links (your email alone, without them). */
  context?: PanelList;
};

/** A step in the checklist: a tick, a title and when ("2020 – now"). It
    opens the thread `tab` names. `now` marks the current one, with a blue
    dot in place of the tick. */
export type PanelStep = { tab: string; title: string; when: string; now?: boolean };

/** A section of the panel that lists rows under a heading. */
export type PanelList = {
  /** The section's heading: "Outputs". */
  title: string;
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

// ---- The account menu ----------------------------------------------------------

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
  /** On a site with more than one language (which needs it), the menu
      row that opens the other language's page, or lists the others when
      there are several: "Language". */
  language?: string;
  /** "Upgrade to Pro": a row that opens the thread `tab` names, which
      says how to hire you. `hire` is the badge on its right ("Hire me"). */
  upgrade: { label: string; hire: string; tab: string };
  /** "Log out": the row's `label`, and the goodbye it shows over the
      page: its `title` ("See you next time."), a line of `text` above your
      contact links, and `back`, the button that brings the page back
      ("Log back in"). */
  logout: { label: string; title: string; text: string; back: string };
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
  /** What it says when your clock is ahead of the visitor's, with {n}
      for the hours between: "{n}h ahead of you". */
  ahead: string;
  /** What it says when your clock is behind theirs: "{n}h behind you". */
  behind: string;
  /** What it says when both clocks read the same: "Same time as you". */
  same: string;
  /** What you're likely doing, by your own time of day: `morning` from
      5:00, `day` from 10:00, `evening` from 18:00 and `late` from 23:00
      (HOURS.mood, in src/contracts/day-parts.ts). */
  moods: Record<ClockMood, string>;
};

/** The times of your day the account menu has a mood for, in order. */
export const CLOCK_MOODS = ["morning", "day", "evening", "late"] as const;

/** One of CLOCK_MOODS. */
export type ClockMood = (typeof CLOCK_MOODS)[number];
