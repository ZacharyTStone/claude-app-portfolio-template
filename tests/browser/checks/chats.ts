/* Chats (new tabs, kept for the visit) and the menus: a thread's, a row's
   and the account's. Each check reads as its steps; the steps longer than a
   line or two are the functions under the list, in the order they're used. */
import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { DATA, LOCAL_ZONE, MENU_KEYS } from "../../../src/contracts/page-attributes.ts";
import { HOURS, partOfDay } from "../../../src/contracts/day-parts.ts";
import { PAGE_CLASSES } from "../../../src/contracts/page-classes.ts";
import { SEPARATOR } from "../../../src/app/constants.ts";
import {
  askInNewChat,
  askReturns,
  attributeOfEach,
  CHAT_ROWS,
  CHATS_HEADING,
  EMAIL_LINK,
  hourIn,
  iPhone,
  minutesAroundNow,
  NO_ANSWER,
  offsetIn,
  OPEN_CHAT,
  OPEN_DRAWER,
  waitForTabToOpen,
  renameTab,
  reportSkip,
  revisit,
  settledTitle,
  shell,
  sidebarRow,
  squash,
  VISITOR_ZONE,
  waitForNoHash,
  windowTitle,
  type Check,
} from "../helpers.ts";
import { CLASS, ID, type Clock, type Site, type Thread } from "../site.ts";

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

/** The checks of chats and of the menus, made for the site as it was read:
    its threads, its languages, its clock. */
export default (site: Site): Check[] => {
  const { A, B, C, words, askUrl } = site;
  return [
    {
      name: "menus by keyboard: the thread's menu, Jump to ›, a row's letter, Escape",
      url: `#${A.id}`,
      async test(page) {
        const chevron = page.locator(`#${A.id} ${CLASS.titleMenuButton}`);
        const menu = page.locator(ID.titleMenu);
        await chevron.focus();
        await page.keyboard.press("Enter");
        await menu.waitFor();
        await checkArrowKeysGoFromRenameToJumpTo(page);
        await checkJumpToOpensAndClosesByArrowKey(page, menu, A);
        await page.keyboard.press("Escape");
        assert.ok(await menu.isHidden(), "Escape closes the menu");
        assert.equal(await chevron.getAttribute("aria-expanded"), "false", "the menu's chevron says it's closed");
        assert.equal(
          await page.locator(`#${A.id} ${CLASS.titleMenuButton}:focus`).count(),
          1,
          "the focus is back on the chevron",
        );
        // A row's letter picks it: R renames.
        await page.keyboard.press("Enter");
        await page.keyboard.press(MENU_KEYS.rename);
        await checkRenamingStartsAndEscapeLeavesTheName(page, A);
      },
    },
    {
      name: "a chat: listed once something's sent, there on the next visit, gone after a refresh, deleted from its menu",
      url: "./",
      async test(page) {
        const question = "A question for a chat";
        await askReturns(page, askUrl, NO_ANSWER);
        await askInNewChatAndGetAReply(page, question);
        assert.deepEqual(await chatNames(page), [question], "the chat is listed under Chats, by its question");

        await revisit(page, site.url("./"));
        await page.locator(CHAT_ROWS).first().click();
        await checkChatIsWholeAndNamesTheWindow(page, site, question);

        await deleteFirstChatFromItsRow(page, words.chatDeleted);
        await checkNoChatIsLeft(page);

        // A refresh starts over: the chat goes, and so its address leads home.
        await askInNewChatAndGetAReply(page, "Another question");
        assert.equal(await page.locator(CHAT_ROWS).count(), 1, "the next chat is listed");
        await page.reload();
        await page.locator(ID.greeting).waitFor();
        await checkNoChatIsLeft(page);
      },
    },
    {
      name: '"New tab" clicked in a new chat leaves its question card open',
      url: "./",
      async test(page) {
        const card = page.locator(ID.questionCard);
        const newTab = page.locator(`${CLASS.nav} ${CLASS.newTab}`);
        // The first opens the chat, and its card once it's open.
        await newTab.click();
        await card.waitFor();
        // In it, a click is done with by the time it returns.
        for (const click of ["second", "third"]) {
          await newTab.click();
          assert.ok(await card.isVisible(), `the card is open after the ${click} click`);
        }
      },
    },
    {
      name: 'on a phone, "New tab" and the name in the drawer leave the new chat\'s card open',
      url: "./",
      device: iPhone,
      async test(page) {
        const card = page.locator(ID.questionCard);
        const chat = page.locator(OPEN_CHAT);
        await card.waitFor();
        const drawerRows = [
          { row: `${CLASS.nav} ${CLASS.newTab}`, called: '"New tab"' },
          { row: CLASS.wordmark, called: "the name" },
        ];
        for (const { row, called } of drawerRows) {
          await chat.locator(CLASS.menuButton).click();
          await page.locator(`${OPEN_DRAWER} ${row}`).click();
          await chat.waitFor();
          assert.ok(await card.isVisible(), `the card is open after a tap on ${called} in the drawer`);
        }
      },
    },
    {
      name: "focus goes back where it was when a menu row is chosen, or the card sends what's chosen",
      url: `#${A.id}`,
      async test(page) {
        const chevron = page.locator(`#${A.id} ${CLASS.titleMenuButton}`);
        const chevronWithFocus = page.locator(`#${A.id} ${CLASS.titleMenuButton}:focus`);
        // A row of the thread's menu, then a row of its submenu.
        await chevron.click();
        await page.locator(`${ID.titleMenu} [${DATA.menuKey}="${MENU_KEYS.copyLink}"]`).click();
        await chevronWithFocus.waitFor();
        await chevron.click();
        await page.locator(`${ID.titleMenu} ${SUBMENU_ROW}`).click();
        await page.locator(`${ID.titleMenu} ${CLASS.submenu} ${MENU_ROW}`).first().click();
        await chevronWithFocus.waitFor();
        // In a chat, a choice from the card is sent, and the card closes onto
        // the composer.
        await askReturns(page, askUrl, NO_ANSWER);
        await askInNewChat(page, "Where does focus go?");
        await page.locator(`${OPEN_CHAT} ${CLASS.composer}:focus`).waitFor();
      },
    },
    {
      name: "Enter or Escape on a word still being composed (Japanese) doesn't rename, or close the card",
      url: `#${A.id}`,
      async test(page) {
        await page.locator(`#${A.id} ${CLASS.titleButton}`).click();
        const nameBox = page.locator(`#${A.id} ${CLASS.titleInput}`);
        await nameBox.fill("にほn");
        await nameBox.dispatchEvent("keydown", { key: "Enter", ...STILL_COMPOSING });
        await nameBox.dispatchEvent("keydown", { key: "Escape", ...STILL_COMPOSING });
        assert.equal(await nameBox.count(), 1, "the tab is still being renamed");
        await page.keyboard.press("Escape");

        await page.locator(`#${A.id} ${CLASS.composer}`).click();
        const cardBox = page.locator(`${ID.questionCard} input`);
        await cardBox.focus();
        await cardBox.dispatchEvent("keydown", { key: "Escape", ...STILL_COMPOSING });
        assert.ok(await page.locator(ID.questionCard).isVisible(), "the card is still open");
      },
    },
    {
      name: "two windows don't undo each other's chats or names",
      url: "./",
      skip: B.id === A.id ? "the site has one thread" : null,
      async test(page) {
        const other = await page.context().newPage();
        await other.goto(site.url("./"));
        const newName = "Renamed in a window";
        // Each asks in a chat of its own, and renames a thread of its own.
        const windows = [
          { window: page, question: "From the first window", thread: A },
          { window: other, question: "From the second window", thread: B },
        ];
        for (const { window, question } of windows) {
          await askReturns(window, askUrl, NO_ANSWER);
          await askInNewChatAndGetAReply(window, question);
        }
        for (const { window, thread } of windows) {
          await sidebarRow(window, thread.id).click();
          await renameTab(window, thread.id, newName);
        }
        await other.close();

        await revisit(page, site.url("./"));
        assert.deepEqual(
          (await chatNames(page)).sort(),
          windows.map(({ question }) => question).sort(),
          "both windows' chats are listed",
        );
        for (const { thread } of windows) {
          assert.equal(
            await page.locator(`#${thread.id} ${CLASS.titleText}`).textContent(),
            newName,
            `#${thread.id} has the name its window gave it`,
          );
        }
      },
    },
    {
      name: "a menu's submenu closes with it: the languages are those of the tab that's open",
      url: `#${A.id}`,
      skip: !site.languages.length ? "the site is in one language" : !C ? "the sidebar has one thread" : null,
      async test(page) {
        if (!C) return;
        // Another language beside the site's own, so the account menu has a
        // submenu of them.
        await serveHomeWithOneMoreLanguage(page, site.url("./"));
        await revisit(page, site.url(`#${A.id}`));
        const menu = page.locator(ID.accountMenu);
        const languages = menu.locator(CLASS.submenu);
        await page.locator(CLASS.accountRow).click();
        await openSubmenuByKeyboard(page, menu);
        // Out of the menu while its submenu is open, and to another tab.
        await page.keyboard.press("Tab");
        await sidebarRow(page, C.id).click();
        await waitForTabToOpen(page, C.id);

        await page.locator(CLASS.accountRow).click();
        assert.ok(await languages.isHidden(), "the submenu closed with its menu");
        await openSubmenuByKeyboard(page, menu);
        const hrefs = await attributeOfEach(languages.locator("a"), "href");
        assert.ok(
          hrefs.length > 1 && hrefs.every((href) => href?.endsWith(`#${C.id}`)),
          `each language's link (there's more than one) is to the open tab, #${C.id}: ${hrefs.join(", ")}`,
        );
      },
    },
    {
      name: "the account menu's submenu is as tall as its rows",
      url: `#${A.id}`,
      skip: !site.languages.length ? "the site is in one language" : null,
      async test(page) {
        await serveHomeWithOneMoreLanguage(page, site.url("./"));
        await revisit(page, site.url(`#${A.id}`));
        const menu = page.locator(ID.accountMenu);
        await page.locator(CLASS.accountRow).click();
        await openSubmenuByKeyboard(page, menu);
        const languages = menu.locator(CLASS.submenu);
        const rows = await languages.locator('[role="menuitem"]').all();
        const rowHeights = await Promise.all(rows.map(async (row) => (await row.boundingBox())?.height ?? 0));
        const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
        const submenuHeight = (await languages.boundingBox())?.height ?? 0;
        assert.ok(
          submenuHeight >= rowsHeight,
          `the submenu (${submenuHeight}px tall) holds its ${rows.length} rows (${rowsHeight}px): the menu's own place isn't the submenu's`,
        );
      },
    },
    {
      name: "a refresh keeps the tab that's open",
      url: `#${A.id}`,
      async test(page) {
        await waitForTabToOpen(page, A.id);
        await page.reload();
        await waitForTabToOpen(page, A.id);
        assert.equal(new URL(page.url()).hash, `#${A.id}`, "the address still names the tab");
        const title = windowTitle(A.title, site);
        assert.equal(await settledTitle(page, (text) => text === title), title, "the window is named after the tab");
      },
    },
    {
      name: "the account menu: the time where you are, the language row keeping the tab, and Log out",
      url: `#${A.id}`,
      async test(page) {
        const accountRow = page.locator(CLASS.accountRow);
        const menu = page.locator(ID.accountMenu);
        await accountRow.click();
        await menu.waitFor();
        await checkArrowKeysPassOverTheClock(page, menu);
        if (site.clock) await checkClockTellsBothTimes(menu, site.clock, site.lang);
        else reportSkip("the account menu's clock", "there's no clock in it");
        await checkLanguageLinksKeepTheOpenTab(menu, site, A.id);
        await page.keyboard.press("Escape");
        assert.ok(await menu.isHidden(), "Escape closes the menu");
        assert.equal(
          await page.locator(`${CLASS.accountRow}:focus`).count(),
          1,
          "the focus is back on the account row",
        );

        // "Log out" really does, and "Log back in" goes home.
        await accountRow.click();
        await menu.locator(`[${DATA.logout}]`).click();
        const goodbye = page.locator(`${CLASS.bye}[role="dialog"]`);
        await goodbye.waitFor();
        await checkGoodbyeIsAllThereIsToReach(page, goodbye);
        await goodbye.locator(CLASS.byeBack).click();
        assert.equal(await goodbye.count(), 0, '"Log back in" takes the goodbye away');
        assert.equal(await shell(page).getAttribute("inert"), null, "the page behind the goodbye can be used again");
        await waitForNoHash(page);
      },
    },
  ];
};

// ---- The thread's menu, by keyboard ------------------------------------------------------

/** With the thread's menu just opened by keyboard: the focus starts on
    Rename, ArrowDown takes it to Copy link, and End to "Jump to ›". */
async function checkArrowKeysGoFromRenameToJumpTo(page: Page): Promise<void> {
  const focused = page.locator(":focus");
  assert.equal(await focused.getAttribute(DATA.menuKey), MENU_KEYS.rename, "the menu opens with the focus on Rename");
  await page.keyboard.press("ArrowDown");
  assert.equal(await focused.getAttribute(DATA.menuKey), MENU_KEYS.copyLink, "ArrowDown goes on to Copy link");
  await page.keyboard.press("End");
  assert.equal(await focused.getAttribute("aria-haspopup"), "menu", "End goes to the last row, Jump to ›");
}

/** With the focus on "Jump to ›": ArrowRight opens its submenu, which lists
    the thread's questions with the focus on the first, and ArrowLeft closes
    it onto "Jump to ›" again. */
async function checkJumpToOpensAndClosesByArrowKey(page: Page, menu: Locator, thread: Thread): Promise<void> {
  const focused = page.locator(":focus");
  const submenu = menu.locator(CLASS.submenu);
  await page.keyboard.press("ArrowRight");
  await submenu.waitFor();
  assert.deepEqual(
    await submenu.locator(MENU_ROW).allTextContents(),
    thread.questions,
    "Jump to › lists the thread's questions",
  );
  assert.equal(squash(await focused.textContent()), thread.questions[0], "the focus is on the first question");
  await page.keyboard.press("ArrowLeft");
  assert.ok(await submenu.isHidden(), "ArrowLeft closes the submenu");
  assert.equal(await focused.getAttribute("aria-haspopup"), "menu", "the focus is back on Jump to ›");
}

/** With Rename just picked from the thread's menu: the title is a box with
    the tab's name in it and the focus, and Escape leaves the name as it was. */
async function checkRenamingStartsAndEscapeLeavesTheName(page: Page, thread: Thread): Promise<void> {
  const nameBox = page.locator(`#${thread.id} ${CLASS.titleInput}:focus`);
  await nameBox.waitFor();
  assert.equal(await nameBox.inputValue(), thread.title, "the box to rename it in holds its name");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(`#${thread.id} ${CLASS.titleInput}`).count(), 0, "Escape takes the box away");
  assert.equal(
    squash(await page.locator(`#${thread.id} ${CLASS.titleText}`).textContent()),
    thread.title,
    "the tab's name is as it was",
  );
}

// ---- A chat, from its first question to its end ------------------------------------------

/** Asks `question` in a new chat, and waits for its reply: "Something
    else", as /ask is stood in for with no answer. */
async function askInNewChatAndGetAReply(page: Page, question: string): Promise<void> {
  await askInNewChat(page, question);
  await page.locator(`${OPEN_CHAT} ${CLASS.thread} ${CLASS.answer} ${EMAIL_LINK}`).waitFor();
}

/** What the sidebar calls each of the visitor's chats. */
const chatNames = (page: Page): Promise<string[]> => page.locator(`${CHAT_ROWS} ${CLASS.rowName}`).allTextContents();

/** The chat that's open has the question that started it and that
    question's reply, and the window is named after it. */
async function checkChatIsWholeAndNamesTheWindow(page: Page, site: Site, question: string): Promise<void> {
  const chat = page.locator(OPEN_CHAT);
  await chat.locator(`${CLASS.thread} > ${CLASS.question}`).filter({ hasText: question }).waitFor();
  assert.ok(
    await chat.locator(`${CLASS.thread} ${CLASS.answer} ${EMAIL_LINK}`).count(),
    "the chat still has the reply to its question",
  );
  const title = windowTitle(question, site);
  assert.equal(await settledTitle(page, (text) => text === title), title, "the window is named after the chat");
}

/** Deletes the first chat from the "…" on its sidebar row, and waits for
    the toast that says so. */
async function deleteFirstChatFromItsRow(page: Page, deletedToast: string): Promise<void> {
  await page.locator(CHAT_ROWS).first().hover();
  await page.locator(`${CHATS_HEADING} + ul ${CLASS.rowMore}`).first().click();
  await page.locator(`${ID.rowMenu} [${DATA.menuKey}="${MENU_KEYS.delete}"]`).click();
  await page.locator(`${CLASS.toast}${CLASS.show}`).filter({ hasText: deletedToast }).waitFor();
}

/** The sidebar lists no chats, and the address is the home screen's: the
    chat that was open is gone. */
async function checkNoChatIsLeft(page: Page): Promise<void> {
  assert.equal(await page.locator(CHATS_HEADING).count(), 0, "the sidebar has no Chats left");
  await waitForNoHash(page);
}

// ---- The account menu's languages --------------------------------------------------------

// A link's hreflang and href, as the page writes them: hreflang="ja" and
// href="/ja/".
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

/** Opens a menu's submenu as the keyboard does: ArrowRight on its row. */
async function openSubmenuByKeyboard(page: Page, menu: Locator): Promise<void> {
  await menu.locator(SUBMENU_ROW).focus();
  await page.keyboard.press("ArrowRight");
  await menu.locator(CLASS.submenu).waitFor();
}

// ---- The account menu --------------------------------------------------------------------

/** The arrow keys go down the account menu without stopping on its clock,
    which is a row that can't be chosen. */
async function checkArrowKeysPassOverTheClock(page: Page, menu: Locator): Promise<void> {
  for (let press = 0; press < ARROW_PRESSES; press++) {
    await page.keyboard.press("ArrowDown");
    assert.equal(
      await menu.locator('[aria-disabled="true"]:focus').count(),
      0,
      "the focus never stops on the clock, which can't be chosen",
    );
  }
}

/** The clock's note says how far the owner's time is from the visitor's and
    the mood of the owner's day, and the visitor's own time is the time in
    VISITOR_ZONE. */
async function checkClockTellsBothTimes(menu: Locator, clock: Clock, lang: string): Promise<void> {
  const note = (await menu.locator(CLASS.clockNote).textContent()) ?? "";
  assert.ok(
    clockNotesAroundNow(clock).includes(note),
    `the clock's note says how far apart the two times are, and the owner's mood, not "${note}"`,
  );
  const visitorTime = squash(await menu.locator(`[${DATA.zone}="${LOCAL_ZONE}"]`).textContent());
  assert.ok(
    visitorTimesAroundNow(lang).includes(visitorTime),
    `the clock shows the visitor's own time, not "${visitorTime}"`,
  );
}

/** What the clock's note may say, around now: how many hours the owner is
    ahead of the visitor or behind, then what the owner's part of the day is
    like. */
function clockNotesAroundNow(clock: Clock): string[] {
  return minutesAroundNow().map((at) => {
    const hoursAhead = (offsetIn(clock.zone, at) - offsetIn(VISITOR_ZONE, at)) / 60;
    const mood = partOfDay(hourIn(clock.zone, at), HOURS.mood);
    return `${howFarApart(clock, hoursAhead)}${SEPARATOR}${clock.moods[mood]}`;
  });
}

/** The clock's words for the owner being `hoursAhead` of the visitor (or
    behind, when it's negative). */
function howFarApart(clock: Clock, hoursAhead: number): string {
  if (hoursAhead === 0) return clock.same;
  const words = hoursAhead > 0 ? clock.ahead : clock.behind;
  return words.replace("{n}", String(Math.abs(hoursAhead)));
}

/** The visitor's own time around now, as the page's language writes it
    ("3:07 PM"). */
function visitorTimesAroundNow(lang: string): string[] {
  const time = new Intl.DateTimeFormat(lang, { timeZone: VISITOR_ZONE, hour: "numeric", minute: "2-digit" });
  return minutesAroundNow().map((at) => squash(time.format(at)));
}

/** The menu's way to another language's page goes to the tab that's open
    there: the one row's link on a site in two languages, each link of the
    submenu on a site in more. A site in one language has neither. */
async function checkLanguageLinksKeepTheOpenTab(menu: Locator, site: Site, openTabId: string): Promise<void> {
  if (site.languages.length === 1) {
    assert.equal(
      await menu.locator(`[${DATA.langLink}]`).getAttribute("href"),
      `${site.languageLink}#${openTabId}`,
      "the language row links to the open tab on the other language's page",
    );
  } else if (site.languages.length > 1) {
    await menu.locator(SUBMENU_ROW).click();
    assert.deepEqual(
      await attributeOfEach(menu.locator(`${CLASS.submenu} a`), "href"),
      site.languages.map((language) => `${language.href}#${openTabId}`),
      "each language's link is to the open tab on its page",
    );
  }
}

/** With the goodbye up after "Log out": it has ways to get in touch, the
    page behind it is inert, and Tab never leaves it for the page (whose
    first stop would be the skip link). */
async function checkGoodbyeIsAllThereIsToReach(page: Page, goodbye: Locator): Promise<void> {
  assert.ok((await goodbye.locator(`${CLASS.byeLinks} a`).count()) > 0, "the goodbye has ways to get in touch");
  assert.equal(await shell(page).getAttribute("inert"), "", "the page behind the goodbye is inert");
  for (let press = 0; press < TAB_PRESSES; press++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.locator(`${CLASS.skip}:focus`).count(),
      0,
      "Tab never reaches the skip link, the first stop in the page behind the goodbye",
    );
  }
}
