/* Chats (new tabs, kept for the visit) and the menus: a thread's, a row's
   and the account's. */
import type { Locator, Page } from "@playwright/test";
import { clockNote, timeIn } from "../../src/app/clock.ts";
import { DATA, LOCAL_ZONE, MENU_KEYS } from "../../src/contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
} from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, NO_ANSWER, test } from "./fixtures.ts";
import {
  CHAT_ROWS,
  CHATS_HEADING,
  EMAIL_LINK,
  NEW_TAB,
  OPEN_CARD,
  OPEN_CHAT,
  OPEN_DRAWER,
  sidebarRow,
  windowTitle,
} from "./parts.ts";
import { halfPast } from "./time.ts";
import { askInNewChat, renameTab, revisit } from "./visitor.ts";

/** A row of a menu, and the row that opens a submenu ("Jump to ›", or the
    account menu's languages). */
const MENU_ROW = '[role="menuitem"]';
const SUBMENU_ROW = '[aria-haspopup="menu"]';

/** What a keydown carries while a word is still being composed, as Japanese
    is typed: Enter and Escape then belong to the input method, not the page. */
const STILL_COMPOSING = { isComposing: true, keyCode: 229 };

/** How many times ArrowDown is pressed in the account menu, to go down past
    its clock; and Tab in the goodbye, to look for a way out of it. */
const ARROW_PRESSES = 3;
const TAB_PRESSES = 8;

/** The hour the page's clock is stopped in, for the account menu's clock:
    an afternoon where the visitor is. */
const AN_AFTERNOON_HOUR = 15;

test.describe("the thread's menu, opened by keyboard", () => {
  test.beforeEach(async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
    await chevronOf(page, site.firstThread.id).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(ID.titleMenu)).toBeVisible();
  });

  test("opens with the focus on Rename; ArrowDown goes on to Copy link, and End to Jump to ›", async ({ page }) => {
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute(DATA.menuKey, MENU_KEYS.rename);
    await page.keyboard.press("ArrowDown");
    await expect(focused).toHaveAttribute(DATA.menuKey, MENU_KEYS.copyLink);
    await page.keyboard.press("End");
    await expect(focused).toHaveAttribute("aria-haspopup", "menu");
  });

  test("ArrowRight on Jump to › lists the thread's questions, with the focus on the first", async ({ page, site }) => {
    const submenu = page.locator(`${ID.titleMenu} ${CLASS.submenu}`);
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowRight");
    await expect(submenu.locator(MENU_ROW)).toHaveText(site.firstThread.questions);
    await expect(page.locator(":focus")).toHaveText(site.firstThread.questions[0] ?? "");
  });

  test("ArrowLeft closes the list of questions onto Jump to › again", async ({ page }) => {
    const submenu = page.locator(`${ID.titleMenu} ${CLASS.submenu}`);
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowRight");
    await expect(submenu).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(submenu).toBeHidden();
    await expect(page.locator(":focus")).toHaveAttribute("aria-haspopup", "menu");
  });

  test("Escape closes it, and the focus is back on its chevron, which says it's closed", async ({ page, site }) => {
    await page.keyboard.press("Escape");
    await expect(page.locator(ID.titleMenu)).toBeHidden();
    await expect(chevronOf(page, site.firstThread.id)).toHaveAttribute("aria-expanded", "false");
    await expect(chevronOf(page, site.firstThread.id)).toBeFocused();
  });

  test("a row's letter picks it: R puts the tab's name in a box to rename it in", async ({ page, site }) => {
    await page.keyboard.press(MENU_KEYS.rename);
    const nameBox = page.locator(`#${site.firstThread.id} ${CLASS.titleInput}`);
    await expect(nameBox).toBeFocused();
    await expect(nameBox).toHaveValue(site.firstThread.title);
  });

  test("Escape in that box takes it away, and leaves the tab's name as it was", async ({ page, site }) => {
    await page.keyboard.press(MENU_KEYS.rename);
    await expect(page.locator(`#${site.firstThread.id} ${CLASS.titleInput}`)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(`#${site.firstThread.id} ${CLASS.titleInput}`)).toHaveCount(0);
    await expect(page.locator(`#${site.firstThread.id} ${CLASS.titleText}`)).toHaveText(site.firstThread.title);
  });
});

test.describe("choosing from a menu or the card", () => {
  test("a row of the thread's menu gives the focus back to the menu's chevron", async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
    await chevronOf(page, site.firstThread.id).click();
    await page.locator(`${ID.titleMenu} [${DATA.menuKey}="${MENU_KEYS.copyLink}"]`).click();
    await expect(chevronOf(page, site.firstThread.id)).toBeFocused();
  });

  test("a row of that menu's submenu gives the focus back to the chevron too", async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
    await chevronOf(page, site.firstThread.id).click();
    await page.locator(`${ID.titleMenu} ${SUBMENU_ROW}`).click();
    await page.locator(`${ID.titleMenu} ${CLASS.submenu} ${MENU_ROW}`).first().click();
    await expect(chevronOf(page, site.firstThread.id)).toBeFocused();
  });

  test("a question sent from a chat's card closes the card onto the composer", async ({ page, ask }) => {
    await ask.returns(NO_ANSWER);
    await page.goto("./");
    await askInNewChat(page, "Where does focus go?");
    await expect(page.locator(`${OPEN_CHAT} ${CLASS.composer}`)).toBeFocused();
  });
});

test.describe("a word still being composed, as Japanese is typed", () => {
  test.beforeEach(async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
  });

  test("Enter or Escape on it doesn't end the renaming of a tab", async ({ page, site }) => {
    await page.locator(`#${site.firstThread.id} ${CLASS.titleButton}`).click();
    const nameBox = page.locator(`#${site.firstThread.id} ${CLASS.titleInput}`);
    await nameBox.fill("にほn");
    await nameBox.dispatchEvent("keydown", { key: "Enter", ...STILL_COMPOSING });
    await nameBox.dispatchEvent("keydown", { key: "Escape", ...STILL_COMPOSING });
    await expect(nameBox, "the tab is still being renamed").toHaveCount(1);
  });

  test("Escape on it doesn't close the question card", async ({ page, site }) => {
    await page.locator(`#${site.firstThread.id} ${CLASS.composer}`).click();
    const cardBox = page.locator(`${ID.questionCard} input`);
    await cardBox.focus();
    await cardBox.dispatchEvent("keydown", { key: "Escape", ...STILL_COMPOSING });
    await expect(page.locator(ID.questionCard)).toBeVisible();
  });
});

test.describe("a chat with a question in it", () => {
  const QUESTION = "A question for a chat";

  test.beforeEach(async ({ page, ask }) => {
    await ask.returns(NO_ANSWER);
    await page.goto("./");
    await askInNewChatAndGetAReply(page, QUESTION);
  });

  test("is listed once under Chats, by its question", async ({ page }) => {
    await expect(page.locator(`${CHAT_ROWS} ${CLASS.rowName}`)).toHaveText([QUESTION]);
  });

  test("is whole on the next visit, and names the window", async ({ page, site }) => {
    await revisit(page, "./");
    await page.locator(CHAT_ROWS).first().click();
    const chat = page.locator(OPEN_CHAT);
    await expect(chat.locator(`${CLASS.thread} > ${CLASS.question}`).filter({ hasText: QUESTION })).toBeVisible();
    await expect(
      chat.locator(`${CLASS.thread} ${CLASS.answer} ${EMAIL_LINK}`),
      "the chat still has the reply to its question",
    ).not.toHaveCount(0);
    await expect(page).toHaveTitle(windowTitle(QUESTION, site));
  });

  test("deleted from its row's menu, leaves no Chats in the sidebar and the home screen's address", async ({
    page,
    site,
  }) => {
    await page.locator(CHAT_ROWS).first().hover();
    await page.locator(`${CHATS_HEADING} + ul ${CLASS.rowMore}`).first().click();
    await page.locator(`${ID.rowMenu} [${DATA.menuKey}="${MENU_KEYS.delete}"]`).click();
    await expect(page.locator(`${CLASS.toast}${CLASS.show}`)).toContainText(site.words.chatDeleted);
    await expectNoChatIsLeft(page);
  });

  test("is gone after a refresh, which starts over: its address leads home", async ({ page }) => {
    await expect(page.locator(CHAT_ROWS)).toHaveCount(1);
    await page.reload();
    await expect(page.locator(ID.greeting)).toBeVisible();
    await expectNoChatIsLeft(page);
  });
});

test('"New tab" clicked again in a new chat leaves its question card open', async ({ page }) => {
  await page.goto("./");
  const card = page.locator(ID.questionCard);
  const newTab = page.locator(NEW_TAB);
  // The first click opens the chat, and its card once it's open.
  await newTab.click();
  await expect(card).toBeVisible();
  for (const click of ["second", "third"]) {
    await newTab.click();
    await expect(card, `the card is open after the ${click} click`).toBeVisible();
  }
});

test.describe("on a phone, in a new chat", () => {
  test.use(A_PHONE);

  const DRAWER_ROWS = [
    { row: NEW_TAB, called: '"New tab"' },
    { row: CLASS.wordmark, called: "the name" },
  ];

  for (const { row, called } of DRAWER_ROWS) {
    test(`a tap on ${called} in the drawer leaves the chat's question card open`, async ({ page }) => {
      await page.goto("./");
      const chat = page.locator(OPEN_CHAT);
      await expect(page.locator(OPEN_CARD)).toBeVisible();
      await chat.locator(CLASS.menuButton).click();
      await page.locator(`${OPEN_DRAWER} ${row}`).click();
      await expect(chat).toBeVisible();
      await expect(page.locator(ID.questionCard)).toBeVisible();
    });
  }
});

test.describe("two windows, each with a chat and a thread renamed of its own", () => {
  const NEW_NAME = "Renamed in a window";
  const QUESTIONS = ["From the first window", "From the second window"];

  test.beforeEach(async ({ page, site, ask, otherThread }) => {
    await page.goto("./");
    const other = await page.context().newPage();
    await other.goto("./");
    await ask.returns(NO_ANSWER);
    await other.route(site.askUrl, (route) => route.fulfill({ json: NO_ANSWER }));
    const windows = [
      { window: page, question: QUESTIONS[0] ?? "", thread: site.firstThread },
      { window: other, question: QUESTIONS[1] ?? "", thread: otherThread },
    ];
    for (const { window, question } of windows) await askInNewChatAndGetAReply(window, question);
    for (const { window, thread } of windows) {
      await sidebarRow(window, thread.id).click();
      await renameTab(window, thread.id, NEW_NAME);
    }
    await other.close();
    await revisit(page, "./");
  });

  test("don't undo each other's chats: both are listed on the next visit", async ({ page }) => {
    const chatNames = await page.locator(`${CHAT_ROWS} ${CLASS.rowName}`).allTextContents();
    expect(chatNames.sort()).toEqual([...QUESTIONS].sort());
  });

  test("don't undo each other's names: each thread has the name its window gave it", async ({
    page,
    site,
    otherThread,
  }) => {
    for (const thread of [site.firstThread, otherThread]) {
      await expect(page.locator(`#${thread.id} ${CLASS.titleText}`)).toHaveText(NEW_NAME);
    }
  });
});

test("a refresh keeps the tab that's open, and the window named after it", async ({ page, site }) => {
  const tab = `#${site.firstThread.id}`;
  await page.goto(tab);
  await expect(page.locator(`${tab}:target`)).toBeVisible();
  await page.reload();
  await expect(page.locator(`${tab}:target`)).toBeVisible();
  expect(new URL(page.url()).hash, "the address still names the tab").toBe(tab);
  await expect(page).toHaveTitle(windowTitle(site.firstThread.title, site));
});

test.describe("the account menu", () => {
  test.beforeEach(async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
    await page.locator(CLASS.accountRow).click();
    await expect(page.locator(ID.accountMenu)).toBeVisible();
  });

  test("arrow keys go down it without stopping on its clock, a row that can't be chosen", async ({ page }) => {
    for (let press = 0; press < ARROW_PRESSES; press++) {
      await page.keyboard.press("ArrowDown");
      await expect(page.locator(`${ID.accountMenu} [aria-disabled="true"]:focus`)).toHaveCount(0);
    }
  });

  test("Escape closes it, and the focus is back on the account row", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expect(page.locator(ID.accountMenu)).toBeHidden();
    await expect(page.locator(CLASS.accountRow)).toBeFocused();
  });

  test("on a site in two languages, its language row links to the open tab on the other's page", async ({
    page,
    site,
  }) => {
    test.skip(site.languages.length !== 1, "the site isn't in exactly two languages");
    await expect(page.locator(`${ID.accountMenu} ${ATTRIBUTE.langLink}`)).toHaveAttribute(
      "href",
      `${site.languageLink}#${site.firstThread.id}`,
    );
  });

  test("on a site in more languages, each one's link in its submenu is to the open tab on its page", async ({
    page,
    site,
  }) => {
    test.skip(site.languages.length < 2, "the site isn't in three languages or more");
    await page.locator(`${ID.accountMenu} ${SUBMENU_ROW}`).click();
    expect(await hrefsOf(page.locator(`${ID.accountMenu} ${CLASS.submenu} a`))).toEqual(
      site.languages.map((language) => `${language.href}#${site.firstThread.id}`),
    );
  });
});

test.describe("the account menu's clock, with the page's clock stopped", () => {
  let now: Date;

  test.beforeEach(async ({ page, site, visitorZone }) => {
    now = halfPast(AN_AFTERNOON_HOUR, visitorZone);
    await page.clock.setFixedTime(now);
    await page.goto(`#${site.firstThread.id}`);
    await page.locator(CLASS.accountRow).click();
    await expect(page.locator(ID.accountMenu)).toBeVisible();
  });

  test("tells both times: how far the owner's is from the visitor's and what that hour is like, and the visitor's own", async ({
    page,
    site,
    clock,
    visitorZone,
  }) => {
    const note = clockNote(clock, timeIn(clock.zone, now), timeIn(visitorZone, now).minutesAheadOfUtc);
    await expect(page.locator(`${ID.accountMenu} ${CLASS.clockNote}`)).toHaveText(note);
    const asThePageWritesIt = new Intl.DateTimeFormat(site.lang, {
      timeZone: visitorZone,
      hour: "numeric",
      minute: "2-digit",
    });
    await expect(page.locator(`${ID.accountMenu} [${DATA.zone}="${LOCAL_ZONE}"]`)).toHaveText(
      asThePageWritesIt.format(now),
    );
  });
});

test.describe("the account menu's languages, on a site in three or more", () => {
  test.beforeEach(async ({ page, site, baseURL, otherThread }) => {
    test.skip(!site.languages.length, "the site is in one language");
    // Another language beside the site's own, so the account menu has a submenu of them.
    await serveHomeWithOneMoreLanguage(page, baseURL ?? "");
    await page.goto(`#${site.firstThread.id}`);
    await page.locator(CLASS.accountRow).click();
    await openSubmenuByKeyboard(page);
    // Out of the menu while its submenu is open, and to another tab.
    await page.keyboard.press("Tab");
    await sidebarRow(page, otherThread.id).click();
    await expect(page.locator(`#${otherThread.id}:target`)).toBeVisible();
    await page.locator(CLASS.accountRow).click();
  });

  test("close with the menu: opened again, it shows no submenu", async ({ page }) => {
    await expect(page.locator(`${ID.accountMenu} ${CLASS.submenu}`)).toBeHidden();
  });

  test("are those of the tab that's open: each link is to it", async ({ page, otherThread }) => {
    await openSubmenuByKeyboard(page);
    const hrefs = await hrefsOf(page.locator(`${ID.accountMenu} ${CLASS.submenu} a`));
    expect(hrefs.length, "the submenu lists more than one language").toBeGreaterThan(1);
    expect(hrefs.filter((href) => !href?.endsWith(`#${otherThread.id}`))).toEqual([]);
  });
});

test("the account menu's submenu of languages is as tall as its rows", async ({ page, site, baseURL }) => {
  test.skip(!site.languages.length, "the site is in one language");
  // Another language beside the site's own, so the account menu has a submenu of them.
  await serveHomeWithOneMoreLanguage(page, baseURL ?? "");
  await page.goto(`#${site.firstThread.id}`);
  await page.locator(CLASS.accountRow).click();
  await openSubmenuByKeyboard(page);
  const languages = page.locator(`${ID.accountMenu} ${CLASS.submenu}`);
  const rowHeights = await languages
    .locator(MENU_ROW)
    .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
  const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const submenuHeight = (await languages.boundingBox())?.height ?? 0;
  expect(
    submenuHeight,
    `the submenu holds its ${rowHeights.length} rows (${rowsHeight}px): the menu's own place isn't the submenu's`,
  ).toBeGreaterThanOrEqual(rowsHeight);
});

test.describe('"Log out"', () => {
  const GOODBYE = `${CLASS.bye}[role="dialog"]`;

  test.beforeEach(async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
    await page.locator(CLASS.accountRow).click();
    await page.locator(`${ID.accountMenu} ${ATTRIBUTE.logout}`).click();
    await expect(page.locator(GOODBYE)).toBeVisible();
  });

  test("shows a goodbye with ways to get in touch, over a page that's inert", async ({ page }) => {
    await expect(page.locator(`${GOODBYE} ${CLASS.byeLinks} a`)).not.toHaveCount(0);
    await expect(page.locator(CLASS.shell)).toHaveAttribute("inert", "");
  });

  test("keeps Tab in the goodbye: it never reaches the skip link, the first stop in the page behind", async ({
    page,
  }) => {
    for (let press = 0; press < TAB_PRESSES; press++) {
      await page.keyboard.press("Tab");
      await expect(page.locator(`${CLASS.skip}:focus`)).toHaveCount(0);
    }
  });

  test('"Log back in" takes the goodbye away, gives the page back, and goes home', async ({ page }) => {
    await page.locator(`${GOODBYE} ${CLASS.byeBack}`).click();
    await expect(page.locator(GOODBYE)).toHaveCount(0);
    await expect(page.locator(CLASS.shell)).not.toHaveAttribute("inert");
    await expect(page).not.toHaveURL(/#/);
  });
});

const chevronOf = (page: Page, tabId: string): Locator => page.locator(`#${tabId} ${CLASS.titleMenuButton}`);

const hrefsOf = (links: Locator): Promise<Array<string | null>> =>
  links.evaluateAll((all) => all.map((link) => link.getAttribute("href")));

/** Asks `question` in a new chat, and waits for its reply: "Something
    else", as /ask is stood in for with no answer. */
async function askInNewChatAndGetAReply(page: Page, question: string): Promise<void> {
  await askInNewChat(page, question);
  await expect(page.locator(`${OPEN_CHAT} ${CLASS.thread} ${CLASS.answer} ${EMAIL_LINK}`)).toBeVisible();
}

/** The sidebar lists no chats, and the address is the home screen's: the
    chat that was open is gone. */
async function expectNoChatIsLeft(page: Page): Promise<void> {
  await expect(page.locator(CHATS_HEADING), "the sidebar has no Chats left").toHaveCount(0);
  await expect(page).not.toHaveURL(/#/);
}

// A link's hreflang and href, as the page writes them: hreflang="ja" and href="/ja/".
const HREFLANG = /hreflang="[^"]*"/;
const HREF = /href="[^"]*"/;

/** From now on the main page (at `home`) is served with one more language
    in its sidebar, "xx", after its first: with more than one other
    language the account menu lists them in a submenu. */
async function serveHomeWithOneMoreLanguage(page: Page, home: string): Promise<void> {
  await page.route(home, async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    // The first link in the sidebar's list of languages, whole: <a …>…</a>.
    const start = html.indexOf(">", html.indexOf(`class="${PAGE_CLASSES.languageSwitch}"`)) + 1;
    const link = html.slice(start, html.indexOf("</a>", start) + "</a>".length);
    const anotherLanguage = link.replace(HREFLANG, 'hreflang="xx"').replace(HREF, 'href="/xx/"');
    await route.fulfill({ response, body: html.replace(link, link + anotherLanguage) });
  });
}

/** Opens the account menu's submenu as the keyboard does: ArrowRight on its row. */
async function openSubmenuByKeyboard(page: Page): Promise<void> {
  await page.locator(`${ID.accountMenu} ${SUBMENU_ROW}`).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(`${ID.accountMenu} ${CLASS.submenu}`)).toBeVisible();
}
