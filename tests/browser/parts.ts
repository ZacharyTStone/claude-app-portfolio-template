/* Parts of the page that more than one file of checks looks for, made of
   the page's own names (src/contracts/page-selectors.ts). */
import type { Locator, Page } from "@playwright/test";
import { SEPARATOR } from "../../src/app/constants.ts";
import { CHATS_GROUP, groupId } from "../../src/contracts/page-ids.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
} from "../../src/contracts/page-selectors.ts";
import type { Site } from "./site.ts";

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
