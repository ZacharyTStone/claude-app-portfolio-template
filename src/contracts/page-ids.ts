/* The ids the page's parts have. A key says what the part is; its value is
   the id the built pages and the stylesheet (src/styles) have, which can't
   import it: change one here, and change it there. */

import type { Panel } from "../config/language.ts";

/** No thread can take one of these (src/site/checks), since a thread's id
    is its tab's. */
export const PAGE_IDS = {
  /** A link to #top closes the open tab: the home screen shows whenever
      no tab is the address's target. */
  home: "top",
  /** A top bar's menu button links to #tabs, which opens the sidebar as a
      drawer on a phone, without JavaScript too. */
  sidebar: "tabs",
  /** The <main> every tab is in: where "Skip to content" goes. */
  main: "main",
  panel: "details",
  greeting: "hello",
  /** The "Something else" tab. The browser code copies it for that reply,
      and for each personal answer's tab. */
  asked: "asked",
  /** The <script> that holds the question card's JSON. */
  questionCardData: "questions",
  accountMenu: "account-menu",
  /** No built page has the rest: the browser code makes them. A thread's
      menu, under the chevron beside its title. */
  titleMenu: "title-menu",
  /** The shorter menu on a thread's sidebar row. */
  rowMenu: "row-menu",
  questionCard: "follow-up",
  /** The heading of the goodbye "Log out" shows. */
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

export const ID_PREFIXES = Object.values(ID_PREFIX);

/** A tab's title names the tab: titleId("about") is "about-title". */
export const titleId = (id: string): string => `${id}-title`;

export const groupId = (id: string): string => `${ID_PREFIX.group}${id}`;

export const panelId = (key: keyof Panel): string => `${ID_PREFIX.panel}${key}`;

export const personalTabId = (id: string): string => `${ID_PREFIX.personal}${id}`;

/** The sidebar group the browser code adds for the visitor's chats. No group
    in the config can have its id. */
export const CHATS_GROUP = "chats";
