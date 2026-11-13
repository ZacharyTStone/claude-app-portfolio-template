/* What a visitor does in more than one file of checks. */
import type { Page } from "@playwright/test";
import { CLASS_SELECTOR as CLASS } from "../../src/contracts/page-selectors.ts";

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
