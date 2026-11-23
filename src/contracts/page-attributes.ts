/* The data-* attributes the page's parts have, and the values some of them
   take. The script's wording has attributes of its own
   (src/config/strings.ts). */

import type { ClockMood } from "../config/language.ts";
import type { GreetingPart } from "./day-parts.ts";

/** Each comment says which element has the attribute and what its value
    is. One with no value only marks its element for the browser code to
    find: a component writes it with `flag` (src/components/attributes.ts). */
export const DATA = {
  /** On <body>: where /ask is, when Ask is on. A page without it sends no
      question anywhere. */
  ask: "data-ask",
  /** On <body>: its language's home page, as the pages link to it ("/",
      "/ja/"). Each of the language's tabs has its page under it
      (tabPagePath). On a link to another language's page: that
      language's, from which the script points the link at the open tab. */
  home: "data-home",
  /** On <body>: the home screen's window title, which a tab's page isn't
      built with. */
  homeTitle: "data-home-title",
  /** Around the home screen's greeting: the greeting for each part of the
      visitor's day, as data-greet-morning and so on. */
  greet: (part: GreetingPart) => `data-greet-${part}` as const,
  /** On the same element: the config's home.tagline, which a new chat
      shows under your name. */
  tagline: "data-tagline",
  /** On a question to start with: the answer it gets ("work.2"). */
  prompt: "data-prompt",
  /** No value: the sidebar's button that hides it. */
  sideToggle: "data-side-toggle",
  /** No value: each button that shows or hides the details panel, the
      panel's own close button among them. */
  panelToggle: "data-panel-toggle",
  /** No value: the share button in a tab's top bar, which copies the
      tab's address. */
  copyLink: "data-copy-link",
  /** On a language's link in the sidebar: the language's name, in itself. */
  languageName: "data-name",
  /** On a chat's tab: the chat's id. The stylesheet looks for it too. */
  chat: "data-chat",
  /** On a menu row: the letter that picks it (MENU_KEYS). */
  menuKey: "data-key",
  /** No value: the account menu's clock, which carries the next four for
      the note the browser code writes under its times. */
  clock: "data-clock",
  /** The config's clock.same, clock.ahead and clock.behind. */
  clockSame: "data-same",
  clockAhead: "data-ahead",
  clockBehind: "data-behind",
  /** The config's clock.moods, as data-mood-morning and so on. */
  mood: (mood: ClockMood) => `data-mood-${mood}` as const,
  /** On each of the clock's times: your time zone, or LOCAL_ZONE. */
  zone: "data-zone",
  /** No value: the account menu's link to the other language's page, at
      the tab that's open. */
  langLink: "data-lang-link",
  /** No value: "Log out" in the account menu, which carries the next three
      for the goodbye it shows. */
  logout: "data-logout",
  /** The config's logout.title, logout.text and logout.back. */
  byeTitle: "data-bye-title",
  byeText: "data-bye-text",
  byeBack: "data-bye-back",
  /** In "Something else", on the link that opens an email: the config's
      asked.email, before the question is put in. It is also how the
      browser code finds the link. */
  emailBody: "data-mail",
  /** On the same link: the config's asked.subject. */
  emailSubject: "data-subject",
  /** Around the LinkedIn message to copy: the config's asked.message.text,
      before the question is put in. */
  messageDraft: "data-draft",
  /** No value: that message's copy button. */
  copyDraft: "data-copy-draft",
  /** In "Something else", on a site with Ask and the contact form, on the
      link to the form's tab: the question it puts in the form's message
      box (the config's asked.q, until the browser code puts the visitor's
      in). It is also how the browser code finds the link. */
  formQuestion: "data-form-question",
  /** On a link that opens in the viewer: the address its frame shows, and
      what the viewer calls it. */
  viewerAddress: "data-view",
  viewerTitle: "data-view-title",
  /** On a link to a post, on a site whose viewer shows its posts: the
      post's own page on this site, which the viewer frames in place of the
      address a config's `viewer` gives. It has data-view-title too. */
  viewerPost: "data-view-post",
  /** On a played picture's Play button: how many seconds it plays, as the
      picture's own file says. */
  play: "data-play",
  /** On each of the contact form's two notes: which it is, a ContactNote
      ("sent" or "failed"), for the browser code to say under Send. */
  contactNote: "data-note",
  /** On the contact form: who takes its messages, a ContactReceiver
      ("worker" or "netlify"), which says how its answer is read. */
  contactReceiver: "data-receiver",
  /** On each list the panel's Context gathered from the answers: the tab
      whose links it lists (its id). The page is built with every tab's,
      the open tab's showing; the script makes a chat's, from the lists of
      the tabs its answers are from, and shows the one for each tab it
      opens. The home screen has none. */
  contextOf: "data-context-of",
  /** No value: a post's card in the Writing tab, a repo's row in the
      panel's activity, a part of the GitHub history in an answer,
      or the <body> of a post's own page, made from
      what the build fetched, which changes from one build to the next. The
      Japanese fonts aren't cut for what's in it (scripts/fonts): it's set
      in the system's Japanese font instead (src/styles/japanese.css). */
  fetched: "data-fetched",
  /** On each part of the GitHub history an answer shows: which part it is
      (a GitHubPart: "stats", "calendar", "languages" or "rhythm"). Each
      has DATA.fetched too. */
  githubPart: "data-github",
  /** On a number in a part of the GitHub history: the count it writes, as
      a plain number ("4812" for "4,812"). As the part comes in, the script
      counts up to it over the number's own animation (src/app/count-up.ts). */
  count: "data-count",
  /** On the home screen's globe: where you are, and where the way it draws
      starts (the config's globe.here and globe.from), each a longitude and
      a latitude in degrees with a space between ("139.69 35.69"); and your
      time zone, for the time beside its marker. */
  globeHere: "data-globe-here",
  globeFrom: "data-globe-from",
  globeZone: "data-globe-zone",
  /** On the same globe, when it shows its visitors: where /visits is. */
  globeVisits: "data-globe-visits",
} as const;

/** In the clock, the time that's the visitor's own: data-zone="local". */
export const LOCAL_ZONE = "local";

export const MENU_KEYS = { rename: "r", copyLink: "c", delete: "d" } as const;

/** The stylesheet has it typed out. To such a visitor a picture that moves
    shows its still, and the script moves nothing. */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
