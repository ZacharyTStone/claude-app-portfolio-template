/* Each tab's own page: opened with its tab open, with JavaScript or without;
   gone to in place, with Back and Forward between tabs; an old #id address;
   the language switch; and the address Share copies. */
import type { Page } from "@playwright/test";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { personalTabId } from "../../src/contracts/page-ids.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
} from "../../src/contracts/page-selectors.ts";
import { tabPagePath } from "../../src/contracts/tab-pages.ts";
import { expect, test } from "./fixtures.ts";
import { NEW_TAB, OPEN_CHAT, OPEN_TAB, openTab, sidebarRow, windowTitle } from "./parts.ts";
import { pasteIntoTheCard } from "./visitor.ts";

/** Marks the page that's loaded, to tell a tab opened in it from a page
    loaded in its place, which wouldn't have the mark. */
const markThePage = (page: Page): Promise<void> =>
  page.evaluate(() => document.body.setAttribute("data-loaded-once", ""));

const expectTheSamePage = (page: Page): Promise<void> => expect(page.locator("body[data-loaded-once]")).toHaveCount(1);

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a tab's page shows its tab, not the home screen, with its row the sidebar's current one", async ({
    page,
    site,
  }) => {
    await page.goto(site.secondThread.path);
    await expect(page.locator(`#${site.secondThread.id} ${CLASS.thread}`)).toBeVisible();
    await expect(page.locator(ID.home)).toBeHidden();
    await expect(page.locator(`${OPEN_TAB}:visible`)).toHaveCount(1);
    await expect(sidebarRow(page, site.secondThread.id)).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveTitle(windowTitle(site.secondThread.title, site));
  });

  test("a row is a link to its tab's page", async ({ page, site, baseURL, otherThread }) => {
    await page.goto(site.firstThread.path);
    await sidebarRow(page, otherThread.id).click();
    await expect(page).toHaveURL(new URL(otherThread.path, baseURL).href);
    await expect(page.locator(`#${otherThread.id} ${CLASS.thread}`)).toBeVisible();
    await expect(page.locator(`#${site.firstThread.id}`)).toBeHidden();
  });

  test("an old address, the home page with a tab's #id, still opens that tab", async ({ page, site }) => {
    await page.goto(`./#${site.secondThread.id}`);
    await expect(page.locator(`#${site.secondThread.id} ${CLASS.thread}`)).toBeVisible();
    await expect(page.locator(ID.home)).toBeHidden();
  });

  test("a personal answer's page shows its answer", async ({ page, site, personalAnswer }) => {
    const tabId = personalTabId(personalAnswer.id);
    await page.goto(site.pathOf(tabId));
    await expect(page.locator(`#${tabId} ${CLASS.thread} > ${CLASS.question}`)).toContainText(personalAnswer.q);
    await expect(page.locator(`#${tabId} ${CLASS.thread} > ${CLASS.answer}`)).toBeVisible();
    await expect(page.locator(ID.home)).toBeHidden();
  });

  test("the language switch goes to the same tab's page in the other language", async ({ page, site }) => {
    const [other] = site.languages;
    test.skip(!other, "the site is in one language");
    await page.goto(site.firstThread.path);
    await page.locator(`${ID.sidebar} ${CLASS.languageSwitch} a[hreflang="${other?.lang}"]`).click();
    await expect(page.locator("html")).toHaveAttribute("lang", other?.lang ?? "");
    await expect(page.locator(`#${site.firstThread.id} ${CLASS.thread}`)).toBeVisible();
  });
});

test.describe("a row clicked", () => {
  test.beforeEach(async ({ page, site }) => {
    await page.goto("./");
    await markThePage(page);
    await sidebarRow(page, site.firstThread.id).click();
  });

  test("opens its tab in the page, at the tab's own address, titled after it", async ({ page, site, baseURL }) => {
    await expect(openTab(page, site.firstThread.id)).toBeVisible();
    await expect(page).toHaveURL(new URL(site.firstThread.path, baseURL).href);
    await expect(page).toHaveTitle(windowTitle(site.firstThread.title, site));
    await expectTheSamePage(page);
  });

  test("and another: Back and Forward go between them, and the home screen", async ({
    page,
    site,
    baseURL,
    otherThread,
  }) => {
    await expect(openTab(page, site.firstThread.id)).toBeVisible();
    await sidebarRow(page, otherThread.id).click();
    await expect(openTab(page, otherThread.id)).toBeVisible();
    await page.goBack();
    await expect(openTab(page, site.firstThread.id)).toBeVisible();
    await expect(page).toHaveURL(new URL(site.firstThread.path, baseURL).href);
    await expect(sidebarRow(page, site.firstThread.id)).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page.locator(ID.greeting)).toBeVisible();
    await expect(page.locator(OPEN_TAB)).toHaveCount(0);
    await page.goForward();
    await page.goForward();
    await expect(openTab(page, otherThread.id)).toBeVisible();
    await expect(page).toHaveTitle(windowTitle(otherThread.title, site));
    await expectTheSamePage(page);
  });

  test("and then the name at the top of the sidebar: the home page, in place", async ({ page, baseURL }) => {
    await page.locator(`${ID.sidebar} ${CLASS.wordmark}`).click();
    await expect(page.locator(ID.greeting)).toBeVisible();
    await expect(page).toHaveURL(baseURL ?? "");
    await expectTheSamePage(page);
  });

  test("and then New tab: a chat, at its #id on the home page, and Back goes to the tab again", async ({
    page,
    site,
    baseURL,
  }) => {
    await page.locator(NEW_TAB).click();
    await expect(page.locator(OPEN_CHAT)).toBeVisible();
    const chatId = (await page.locator(OPEN_CHAT).getAttribute("id")) ?? "";
    await expect(page).toHaveURL(new URL(`#${chatId}`, baseURL).href);
    await page.goBack();
    await expect(openTab(page, site.firstThread.id)).toBeVisible();
  });
});

test.describe("an old address, with a tab's #id", () => {
  test("opens the tab, and gives way to its page's address in the history", async ({ page, site, baseURL }) => {
    await page.goto(site.firstThread.path);
    const stepsBefore = await page.evaluate(() => history.length);
    await page.goto(`./#${site.secondThread.id}`);
    await expect(openTab(page, site.secondThread.id)).toBeVisible();
    await expect(page).toHaveURL(new URL(site.secondThread.path, baseURL).href);
    await expect(page).toHaveTitle(windowTitle(site.secondThread.title, site));
    const stepsAfter = await page.evaluate(() => history.length);
    expect(stepsAfter, "the page took one step in the history, not one more for the old address").toBe(stepsBefore + 1);
  });

  test("on another tab's page opens the tab it names", async ({ page, site, baseURL, otherThread }) => {
    await page.goto(`${site.firstThread.path}#${otherThread.id}`);
    await expect(openTab(page, otherThread.id)).toBeVisible();
    await expect(page.locator(`#${site.firstThread.id}`)).toBeHidden();
    await expect(page).toHaveURL(new URL(otherThread.path, baseURL).href);
  });
});

test("the language switch keeps the tab that's open, after moving to another in the page", async ({
  page,
  site,
  otherThread,
}) => {
  const [other] = site.languages;
  test.skip(!other, "the site is in one language");
  await page.goto(site.firstThread.path);
  await sidebarRow(page, otherThread.id).click();
  await expect(openTab(page, otherThread.id)).toBeVisible();
  const languageLink = page.locator(`${ID.sidebar} ${CLASS.languageSwitch} a[hreflang="${other?.lang}"]`);
  const otherHome = (await languageLink.getAttribute(DATA.home)) ?? "";
  await expect(languageLink).toHaveAttribute("href", tabPagePath(otherHome, otherThread.id));
  await languageLink.click();
  await expect(page.locator("html")).toHaveAttribute("lang", other?.lang ?? "");
  await expect(openTab(page, otherThread.id)).toBeVisible();
});

test.describe("Share", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copies the address of the tab's page, after moving to it in the page", async ({
    page,
    site,
    baseURL,
    otherThread,
  }) => {
    await page.goto(site.firstThread.path);
    await sidebarRow(page, otherThread.id).click();
    const tab = `#${otherThread.id}`;
    await page.locator(`${tab} ${ATTRIBUTE.copyLink} ${CLASS.label}`).click();
    expect(await pasteIntoTheCard(page, tab)).toBe(new URL(otherThread.path, baseURL).href);
  });

  test("on a personal answer's tab copies its page's address", async ({ page, site, baseURL, personalAnswer }) => {
    const tabId = personalTabId(personalAnswer.id);
    await page.goto(site.pathOf(tabId));
    await page.locator(`#${tabId} ${ATTRIBUTE.copyLink} ${CLASS.label}`).click();
    expect(await pasteIntoTheCard(page, `#${tabId}`)).toBe(new URL(site.pathOf(tabId), baseURL).href);
  });
});
