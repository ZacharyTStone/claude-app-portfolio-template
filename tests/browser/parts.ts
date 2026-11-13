/* Parts of the page that more than one file of checks looks for, made of
   the page's own names (src/contracts/page-selectors.ts). */
import type { Locator, Page } from "@playwright/test";
import { SEPARATOR } from "../../src/app/constants.ts";
import { CHATS_GROUP, groupId, ID_PREFIX } from "../../src/contracts/page-ids.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
  PART_SELECTOR as PART,
} from "../../src/contracts/page-selectors.ts";
import type { Site } from "./site.ts";

/** "New tab", in the sidebar. */
export const NEW_TAB = `${CLASS.nav} ${CLASS.newTab}`;

/** The chat that's open. */
export const OPEN_CHAT = `${CLASS.tab}${ATTRIBUTE.chat}:target`;

/** The question card, while it shows. */
export const OPEN_CARD = `${ID.questionCard}:not([hidden])`;

/** The sidebar while it's a phone's drawer, and open. */
export const OPEN_DRAWER = `${ID.sidebar}${CLASS.drawerOpen}`;

/** The heading the script adds to the sidebar for the visitor's chats,
    there only while there's a chat to list. */
export const CHATS_HEADING = `#${groupId(CHATS_GROUP)}`;

/** The visitor's chats in the sidebar: a row each. */
export const CHAT_ROWS = `${CHATS_HEADING} + ul a`;

/** The link to email the owner, in the "Something else" reply: what a
    question gets when the site has no answer for it. The checks know that
    reply by this link. */
export const EMAIL_LINK = ATTRIBUTE.emailBody;

/** The details panel's sections, in the order the page has them. */
export const PANEL_SECTIONS = `${ID.panel} > section`;

/** A tab's row in the sidebar: its first, as a thread can be among the
    rows at the top and in a group too. */
export const sidebarRow = (page: Page, tabId: string): Locator =>
  page.locator(`${ID.sidebar} a[href="#${tabId}"]`).first();

/** The window's title while a tab is open. */
export const windowTitle = (tabName: string, site: Site): string => `${tabName}${SEPARATOR}${site.name}`;

/** What a visitor typed, as their question's bubble has it: its last words,
    after the "Question: " said only to screen readers. */
export const wordsTyped = (questionBubble: Locator): Promise<string | null> =>
  questionBubble.evaluate((bubble) => bubble.lastChild?.nodeValue ?? null);

/** What a visitor's questions in one of the site's own tabs have got back:
    what's sent into a tab is marked, as a chat's messages aren't. */
export function sentInto(page: Page, tabId: string) {
  const sent = `#${tabId} ${CLASS.thread} > ${CLASS.sent}`;
  return {
    everything: page.locator(sent),
    questions: page.locator(`${sent}${CLASS.question}`),
    answers: page.locator(`${sent}${CLASS.answer}`),
    emailLinks: page.locator(`${sent} ${EMAIL_LINK}`),
    whereFrom: page.locator(`${sent} ${CLASS.from}`),
  };
}

/** A visitor's chat, in the sidebar: its first, the newest. */
export const firstChatRow = (page: Page): Locator =>
  page.locator(`${ID.sidebar} a[href^="#${ID_PREFIX.chat}"]`).first();

/** A figure whose picture a visitor plays, and in it its Play button and
    the picture as it moves, once that has loaded and shows. */
export const PLAYED_FIGURE = CLASS.playedFigure;
export const PLAY_BUTTON = PART.playButton;
export const PLAYING_PICTURE = `${CLASS.moving}${CLASS.movingShown}`;

/** A picture that moves all the time, as the page has it: the one thing a
    page puts in a <picture> (Picture.astro), with the still in its
    <source>. */
export const MOVING_PICTURE = "picture";

/** A quote or a file card in an answer that is shown: not one inside a
    status line that hasn't been opened. */
export const COMES_INTO_VIEW = `:is(${PART.comesIntoView}):not(details:not([open]) *)`;
