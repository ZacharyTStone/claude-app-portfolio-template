/* What a visitor does in more than one file of checks. */
import type { Locator, Page } from "@playwright/test";
import { CLASS_SELECTOR as CLASS, ID_SELECTOR as ID } from "../../src/contracts/page-selectors.ts";
import { NEW_TAB, OPEN_CARD } from "./parts.ts";
import { tabIdOf } from "./site.ts";

/** A new visit to `url`: a fresh page load, but not a refresh, which ends
    the visit's chats. */
export async function revisit(page: Page, url: string): Promise<void> {
  await page.goto("about:blank");
  await page.goto(url);
}

/** Renames a tab as a visitor does: a click on its title, the new name
    over the old, Enter. Renamed to "", a thread gets its own name back. */
export async function renameTab(page: Page, tabId: string, name: string): Promise<void> {
  await page.locator(`#${tabId} ${CLASS.titleButton}`).click();
  await page.keyboard.press("ControlOrMeta+A");
  if (name) await page.keyboard.type(name);
  else await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
}

/** The question card's first choice that opens a tab, after opening the
    first topic when that asks which first. */
export async function firstTabChoice(page: Page): Promise<Locator> {
  const firstChoice = page.locator(`${ID.questionCard} ${CLASS.options} li > *`).first();
  // A choice that links to a tab opens it. One that doesn't is a topic: it
  // lists its own choices in the card, so the first is looked at again.
  while (!(await firstChoice.getAttribute("href"))) await firstChoice.click();
  return firstChoice;
}

/** Picks the question card's first choice that opens a tab, and says which
    tab that is. */
export async function pickFirstTab(page: Page): Promise<string> {
  const choice = await firstTabChoice(page);
  const tabId = tabIdOf(await choice.getAttribute("href"));
  await choice.click();
  return tabId;
}

/** Types a question into a tab's composer, and sends it. */
export async function askIn(page: Page, tabId: string, question: string): Promise<void> {
  await page.locator(`#${tabId} ${CLASS.composer}`).click();
  await page.keyboard.type(question);
  await page.keyboard.press("Enter");
}

/** Opens a new chat from the sidebar, and asks `question` in its card. */
export async function askInNewChat(page: Page, question: string): Promise<void> {
  await page.locator(NEW_TAB).click();
  await page.locator(OPEN_CARD).waitFor();
  await page.keyboard.type(question);
  await page.keyboard.press("Enter");
}
