/* The shape of site.config.ts: everything the site says, in every
   language. This file is the config's manual: each field says what it is,
   where it shows on the page, and what happens when it's left out.

   Reading order: SiteConfig (the whole site), then Language (one
   language's page) and its parts in the order the page draws them: Home,
   Sidebar, Thread, Asked, Panel, Account, Strings. What an answer is made
   of (paragraphs, cards, figures) is in content.ts, and the question card
   in page-data.ts, because the page hands it to the browser code as it is.

   Types can't say everything. That a `tab` names a thread, an `icon` is one
   the stylesheet has, and every language has the same threads is checked
   before a build (src/site/validate.ts), which stops with a message that
   names the field. */

import type { Hsts } from "./headers.ts";
import type { Block, Card, Markdown } from "./content.ts";
import type { OptionalScriptString, QuestionCard, ScriptString } from "./page-data.ts";

// ---- The whole site --------------------------------------------------------------

/** The whole site: what site.config.ts exports. */
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
  /** Your name, as the site writes it everywhere ("Alex Example"): the
      wordmark at the top of the sidebar, the window's title after an open
      tab's name ("About · Alex Example"), the label under every tab's
      composer (before strings.model), the 404 page's title, and what Ask's
      model calls you. A language that writes it another way says so in its
      own `person.name`. */
  name: string;
  /** The language your name is written in ("en"), so pages in other
      languages mark it (lang="en" on the wordmark, for a screen reader to
      say it right). Leave out if no page needs to. */
  nameLang?: string;
  /** Your time zone, for the clock in the account menu ("Asia/Tokyo"): an
      IANA name, which the build checks. */
  timezone: string;
  /** How to reach you. */
  links: ContactLinks;
  /** More about you for search engines (schema.org Person data in the
      page's <head>). None of it shows on the page. Leave out, or leave any
      field out, to say less. */
  person?: SchemaPerson;
  /** The social card: the picture a link to the site is previewed with. */
  social: SocialCard;
  /** The colour a browser draws its own bars in around the page, where it
      does (<meta name="theme-color">): "#191919", or a colour's name. */
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
  /** Links that open in the site's own viewer, a panel beside the
      conversation (the whole screen on a phone), instead of in a new tab:
      each link's address, exactly as an `href` in this config has it, and
      the address the viewer shows in a frame. Wherever a link card, a
      picture or a row of the details panel links to one of them, it opens
      in the viewer.

          viewer: {
            "https://docs.google.com/document/d/abc123/edit": "https://docs.google.com/document/d/abc123/preview",
          }

      A Google Doc, Sheet or Slides deck that anyone with the link can view
      is shown at its address ending "/preview". Not every site lets itself
      be shown in a frame (GitHub and LinkedIn don't): open the viewer once
      and look.

      What a frame shows is loaded from that other site, which sees the
      visitor as any site they open does. It's the one thing a page of
      yours loads from anywhere else, and only once the visitor opens it:
      the security policy (src/shared/headers.ts) lets frames come from
      these addresses' sites and no other. Without JavaScript the link
      opens as any link does.

      It needs strings.viewerOpen and strings.viewerClose in each
      language. Leave out for a site with no viewer: every link then opens
      as links do. */
  viewer?: Record<string, string>;
  /** llms.txt, the site as plain text for a model reading it on someone's
      behalf: a one-line summary, and a paragraph about you. The build adds
      the rest: the details panel's links, how to reach you, and every
      question the site answers with its answer, in the main language. */
  llms: {
    /** One line, quoted under the file's heading: who you are and what the
        site is. */
    summary: string;
    /** A paragraph under "About". */
    about: string;
  };
  /** Each language's text, by its code ("en", "ja", "pt-BR"). The first is
      the site's main one, at /. Each other one is at /<code>/, gets a
      switch in the sidebar, and has the same threads and questions with
      the same ids. With one language the site has no switch.

          languages: { en: { …the English page… }, ja: { …the Japanese page… } } */
  languages: Record<string, Language>;
};

/** The hosts `host` can name. */
export const HOSTS = ["cloudflare", "netlify", "vercel", "github-pages", "static"] as const;

/** One of HOSTS. */
export type Host = (typeof HOSTS)[number];

/** How to reach you: the account menu, "Something else", the printed page,
    llms.txt and the schema.org data all read these. */
export type ContactLinks = {
  /** Your email address ("alex@example.com", no "mailto:"). It's the
      account menu's first row and the link "Something else" offers. */
  email: string;
  /** Your GitHub profile's address ("https://github.com/alex-example").
      With it, the account menu has a GitHub row. Leave out for none. */
  github?: string;
  /** Your LinkedIn profile's address. With it, "Something else" also
      offers a message to send there (each language then needs
      asked.linkedin and asked.message). Leave out for none. */
  linkedin?: string;
};

/** What the schema.org Person data says beyond your name and job title
    (those are each language's `person`). */
export type SchemaPerson = {
  /** A picture of you: a path on the site ("/assets/portrait.webp"). */
  image?: string;
  /** Your employer's name: "Acme". */
  worksFor?: string;
  /** Where you studied: "Example University". */
  alumniOf?: string;
  /** Where you're based: "JP". */
  country?: string;
  /** The languages you speak, as codes: ["en", "ja"] (the site's own
      languages, if left out). */
  knowsLanguage?: string[];
};

/** The picture a link to the site is previewed with (Open Graph and
    Twitter cards). Each language's meta.imageAlt says what it shows. */
export type SocialCard = {
  /** A path on the site: "/assets/og.png". */
  image: string;
  /** Its size in pixels: 1200 by 630 is the usual. */
  width: number;
  height: number;
};

// ---- One language's page -------------------------------------------------------

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
      the personal answers (page-data.ts has its shape). */
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
    (HOURS.greeting, in page-data.ts). */
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
      (content.ts's Block). */
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
      (HOURS.mood, in page-data.ts). */
  moods: Record<ClockMood, string>;
};

/** The times of your day the account menu has a mood for, in order. */
export const CLOCK_MOODS = ["morning", "day", "evening", "late"] as const;

/** One of CLOCK_MOODS. */
export type ClockMood = (typeof CLOCK_MOODS)[number];

// ---- The page's wording --------------------------------------------------------

/** The wording the page itself shows (the browser code's is SCRIPT_STRINGS,
    in page-data.ts). Every language's `strings` has each of them. */
export const PAGE_STRINGS = [
  // The link a keyboard reaches first: "Skip to content".
  "skip",
  // The sidebar's name, for screen readers: "Tabs".
  "tabs",
  // The button in the sidebar that hides it (its label and tooltip), the
  // link that closes it when it's a drawer on a phone, and the button in
  // every top bar that shows it again.
  "hideTabs",
  "closeTabs",
  "showTabs",
  // The button in every top bar that shows or hides the details panel: its
  // label for screen readers, and its shorter tooltip ("Details").
  "panelToggle",
  "panelToggleTitle",
  // The small print under the home screen and under every tab's composer.
  "credit",
  // A tab's share button: "Share".
  "share",
  // The copy icon under a thread's last answer: its label for screen
  // readers ("Copy link to this tab"), and its tooltip ("Copy link").
  "copyTab",
  "copyTitle",
  // Said to screen readers before each question: "Question: ".
  "question",
  // What the composer under every tab says: "Ask a follow-up…".
  "followUpPlaceholder",
  // After your name under that composer, where the app names its model:
  // "Portfolio", to read "Alex Example Portfolio".
  "model",
  "status", // "Read {file}"
  // The details panel's name, for screen readers ("Details"), and its close
  // button's label and tooltip.
  "panel",
  "closePanel",
  "closePanelTitle",
] as const;

/** The name of one of PAGE_STRINGS. */
export type PageString = (typeof PAGE_STRINGS)[number];

/** A language's wording: every page and script string, and the optional
    script strings for the parts the site has (the build says which are
    missing). */
export type Strings = Record<PageString | ScriptString, string> & Partial<Record<OptionalScriptString, string>>;
