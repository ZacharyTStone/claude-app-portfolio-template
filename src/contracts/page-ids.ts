/* The ids the components (src/components) write into the page, the browser
   code (src/app) finds there or makes more of, and the browser checks
   (tests/browser) look for. The values are part of the built page, and the
   stylesheet (src/styles) has them typed out, as it can't import them:
   change one here, and change it there. */

import type { Panel } from "../config/language.ts";

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

/** The sidebar group the browser code adds for the visitor's chats. No group
    in the config can have its id. */
export const CHATS_GROUP = "chats";
