/* The data-* attributes the components (src/components) write into the
   page, the browser code (src/app) finds there or makes more of, and the
   browser checks (tests/browser) look for; and the values some of them
   have. The script's wording has attributes of its own
   (src/config/strings.ts). */

import type { ClockMood } from "../config/language.ts";
import type { GreetingPart } from "./day-parts.ts";

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

/** In the clock, the time that's the visitor's own: data-zone="local". */
export const LOCAL_ZONE = "local";

/** The letters that pick the rows of a thread's menus. */
export const MENU_KEYS = { rename: "r", copyLink: "c", delete: "d" } as const;

/** The media query that's true for a visitor whose computer asks for less
    motion: a picture that moves shows its still to them (Picture.astro),
    and the script moves nothing (src/app/lib/motion.ts). The stylesheet
    has it typed out. */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
