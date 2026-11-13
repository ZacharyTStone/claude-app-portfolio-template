/* The data-* attributes the page's parts have, and the values some of them
   take. The script's wording has attributes of its own
   (src/config/strings.ts). */

import type { ClockMood } from "../config/language.ts";
import type { GreetingPart } from "./day-parts.ts";

/** Each comment says which element has the attribute and what its value
    is. One with no value only marks its element for the browser code to
    find: a component writes it with `flag` (src/components/attributes.ts). */
export const DATA = {
  /** On <html>: where /ask is, when Ask is on. A page without it sends no
      question anywhere. */
  ask: "data-ask",
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
  /** No value: the share button in a tab's top bar, and the copy icon
      under an answer. Both copy the tab's address. */
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
  /** No value: the account menu's link to the other language's page. */
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
  /** On a link that opens in the viewer: the address its frame shows, and
      what the viewer calls it. */
  viewerAddress: "data-view",
  viewerTitle: "data-view-title",
  /** On a played picture's Play button: how many seconds it plays, as the
      picture's own file says. */
  play: "data-play",
} as const;

/** In the clock, the time that's the visitor's own: data-zone="local". */
export const LOCAL_ZONE = "local";

export const MENU_KEYS = { rename: "r", copyLink: "c", delete: "d" } as const;

/** The stylesheet has it typed out. To such a visitor a picture that moves
    shows its still, and the script moves nothing. */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
