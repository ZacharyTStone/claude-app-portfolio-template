/* The shape of site.config.ts: everything the site says, in every
   language. The build reads all of it; the page passes the question card
   and the script's wording on to the browser code (page-data.ts). */

import type { Hsts } from "./headers.ts";
import type { Block, Card, Markdown } from "./content.ts";
import type { QuestionCard, ScriptString } from "./page-data.ts";

export type SiteConfig = {
  /** Where the site is: "https://example.com". If it is served under a
      path, as a GitHub project site is, include it:
      "https://you.github.io/portfolio/". Every link the pages make then
      starts with that path. Paths elsewhere in the config
      ("/assets/og.png") are from the site's own root, wherever that is. */
  url: string;
  /** Who serves the built site, dist/ ("cloudflare" if left out). It decides
      how the security headers in src/shared/headers.ts reach the browser:
      - "cloudflare" and "netlify" read a _headers file, which the build
        writes into dist/. Cloudflare (Workers static assets, set up by
        your own wrangler.jsonc) is the only host that runs Ask's Worker.
      - "vercel", "github-pages" and "static" (any other host: S3, nginx,
        Caddy…) get no file, so every page carries its
        Content-Security-Policy and referrer policy in <meta> tags
        (browsers take no others from a page). Set the rest on the host
        where it lets you.
      Each host runs `npm run build` and publishes dist/. */
  host?: Host;
  /** Strict-Transport-Security's extras, includeSubDomains and preload.
      Both are hard to undo: leave them out unless every subdomain is
      HTTPS for good. */
  hsts?: Hsts;
  /** Your name: the wordmark, the model label, page titles. */
  name: string;
  /** The language your name is written in ("en"), so pages in other
      languages mark it. */
  nameLang?: string;
  /** Your time zone, for the clock in the account menu ("Asia/Tokyo"). */
  timezone: string;
  links: {
    email: string;
    github?: string;
    /** With it, "Something else" also offers a message to send there
        (asked.linkedin and asked.message). */
    linkedin?: string;
  };
  /** For the schema.org Person data only. */
  person?: {
    /** A path on the site. */
    image?: string;
    worksFor?: string;
    alumniOf?: string;
    /** Where you're based: "JP". */
    country?: string;
    /** The languages you speak (the site's, if left out). */
    knowsLanguage?: string[];
  };
  /** The social card: an image on the site, and its size. */
  social: { image: string; width: number; height: number };
  themeColor: string;
  /** A question typed into the card goes to /ask (ASK_PATH, in ask.ts), where a
      small model picks which of the site's answers it's asking for. Leave
      out to turn that off: a typed question then always gets the
      "Something else" reply. It needs host "cloudflare", where its Worker
      runs. */
  ask?: {
    /** Who you are, in a few words, for the model: "a software engineer". */
    role: string;
  };
  /** llms.txt, the site as plain text for a model reading it on someone's
      behalf: a one-line summary, and a paragraph about you. The build adds
      the rest: the details panel's links, how to reach you, and every
      question the site answers with its answer, in the main language. */
  llms: { summary: string; about: string };
  /** Each language's text, by its code. The first is the site's main one,
      at /. Each other one is at /<code>/, gets a switch in the sidebar, and
      has the same threads and questions with the same ids. */
  languages: Record<string, Language>;
};

/** The hosts `host` can name. */
export const HOSTS = ["cloudflare", "netlify", "vercel", "github-pages", "static"] as const;

export type Host = (typeof HOSTS)[number];

/** Everything one language's page says. */
export type Language = {
  /** In the language switch: "EN". */
  label: string;
  /** The language's own name: "English", "日本語". */
  name: string;
  /** For Open Graph: "en_US". */
  locale: string;
  /** Text direction ("ltr" if left out). */
  dir?: "ltr" | "rtl";
  meta: {
    title: string;
    description: string;
    /** The social card's alt text. */
    imageAlt: string;
    /** Fonts the page loads up front. */
    preload: string[];
  };
  /** Your name and job title in this language (schema.org, print). */
  person: { name: string; jobTitle: string };
  home: Home;
  sidebar: Sidebar;
  /** The conversations: one tab each. */
  threads: Thread[];
  asked: Asked;
  panel: Panel;
  account: Account;
  questions: QuestionCard;
  /** The 404 page, which has every language's `text` and `back`. */
  notFound: { title: string; text: string; back: string };
  strings: Strings;
};

/** The home screen. */
export type Home = {
  /** `default` without JavaScript; the others by the visitor's time of day. */
  greeting: { default: string; morning: string; afternoon: string; evening: string; late: string };
  /** Under the greeting: a line or so, as the home screen is meant to be
      light. */
  intro: Markdown;
  /** Its own line under the intro, after an arrow pointing at the tabs
      (not on phones, where the tabs are a drawer). */
  hint?: string;
  /** One line under your name at the top of a new chat, which is where a
      visit starts on a phone. */
  tagline?: string;
  /** Questions to start with, under the box to type in on the home screen
      (which needs JavaScript, as they do): a few, each short enough for
      one line. */
  prompts?: Prompt[];
};

/** A question to start with: choosing it opens a new chat and sends `q`,
    and the reply is the answer `answer` names, word for word, as /ask
    names them: "work.2" is the second answer in the thread "work", and
    "personal-food.1" the personal answer "food". */
export type Prompt = { q: string; answer: string };

export type Sidebar = {
  newTab: string;
  /** The rows at the top. Icons are the .i-* classes in src/styles. */
  nav: Array<{ tab: string; icon: string; label: string }>;
  groups: SidebarGroup[];
};

/** Rows under a heading ("Work history"), below the ones at the top. */
export type SidebarGroup = { id: string; label: string; tabs: SidebarRow[] };

export type SidebarRow = {
  tab: string;
  title: string;
  subtitle: string;
  /** Shows a blue dot, with this as its tooltip. */
  live?: string;
};

/** What a thread's, a sidebar group's or a personal answer's id looks
    like: lowercase letters, digits and dashes ("about"). */
export const ID = /^[a-z][a-z0-9-]*$/;

/** A conversation: a tab of its own, at #id. */
export type Thread = {
  /** Its address (#about): an ID. */
  id: string;
  title: string;
  pill?: Pill;
  /** Picked in the question card in a chat, a thread is sent as its first
      question and one reply made of all its answers, without the later
      questions: write each later answer to read on from the one before
      (not "Yes."). */
  messages: Message[];
};

/** A label beside a thread's title in the top bar, with a blue dot if
    `live`. */
export type Pill = { label: string; live?: boolean };

/** A question and its answer. */
export type Message = {
  q: Markdown;
  read?: StatusLine;
  a: Block[];
};

/** "Read experience/acme.md" above an answer: it opens onto a card. */
export type StatusLine = { file: string; card: Card };

/** "Something else": the reply to a question the site has no answer for,
    with ways to ask you instead. In `email` and `message.text`,
    {question} is what the visitor asked, as they typed it. That's about
    you, not to you ("Does Alex…?"), and for a visitor who's been blocked
    it's nothing at all, so give it a line of its own ("A question from
    your portfolio:", then {question}) rather than a place in a sentence. */
export type Asked = {
  title: string;
  /** The question it shows without JavaScript. */
  q: string;
  answer: Markdown;
  /** The label of the link that opens the email. */
  mail: string;
  subject: string;
  email: string;
  /** With links.linkedin: the label of its link, and a message to copy. */
  linkedin?: string;
  message?: { label: string; text: string; copy: string };
};

/** The details panel on the right. Each section is optional. */
export type Panel = {
  /** The career as a checklist. */
  progress?: { title: string; steps: PanelStep[] };
  outputs?: { title: string; rows: PanelRow[] };
  context?: { title: string; rows: PanelRow[] };
};

/** A step in the checklist; `now` marks the current one. */
export type PanelStep = { tab: string; title: string; when: string; now?: boolean };

export type PanelRow = {
  label: string;
  meta: string;
  /** An .i-* icon, or github or linkedin. */
  icon: string;
  /** Leave out for a row that isn't a link. */
  href?: string;
};

/** The account row at the bottom of the sidebar, and its menu. */
export type Account = {
  /** In the avatar. */
  initial: string;
  name: string;
  sub: string;
  /** The menu's name, for screen readers. */
  label: string;
  /** Your time beside the visitor's. `ahead` and `behind` take {n}, the
      hours between; `moods` are by your time of day. */
  clock: {
    /** The label beside your time. */
    me: string;
    /** Your time zone's name, shown until the script sets the time. */
    zone: string;
    you: string;
    ahead: string;
    behind: string;
    same: string;
    moods: Record<ClockMood, string>;
  };
  /** On a site with more than one language, the row that opens the first
      of the others. */
  language?: string;
  /** "Upgrade to Pro": hire you. */
  upgrade: { label: string; hire: string; tab: string };
  /** "Log out": a goodbye with your contact links, and a way back. */
  logout: { label: string; title: string; text: string; back: string };
};

/** The times of your day the account menu has a mood for, in order. */
export const CLOCK_MOODS = ["morning", "day", "evening", "late"] as const;

export type ClockMood = (typeof CLOCK_MOODS)[number];

/** The wording the page itself shows (the browser code's is SCRIPT_STRINGS). */
export const PAGE_STRINGS = [
  "skip",
  "tabs",
  "hideTabs",
  "closeTabs",
  "showTabs",
  "panelToggle",
  "panelToggleTitle",
  "credit",
  "share",
  "copyTab",
  "copyTitle",
  "question",
  "followUpPlaceholder",
  "model",
  "status", // "Read {file}"
  "panel",
  "closePanel",
  "closePanelTitle",
] as const;

export type PageString = (typeof PAGE_STRINGS)[number];

export type Strings = Record<PageString | ScriptString, string>;
