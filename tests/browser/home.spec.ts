/* The home screen (its greeting, its box and the questions to start with
   under it), and a thread's own tab: its name and its link. */
import type { Locator, Page } from "@playwright/test";
import { HOURS, type GreetingPart } from "../../src/contracts/day-parts.ts";
import { parseAnswerId } from "../../src/contracts/ask.ts";
import { DATA, MENU_KEYS } from "../../src/contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import { PAGE_IDS } from "../../src/contracts/page-ids.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
} from "../../src/contracts/page-selectors.ts";
import { expect, NO_ANSWER, test } from "./fixtures.ts";
import {
  CHAT_ROWS,
  EMAIL_LINK,
  OPEN_CHAT,
  openTab,
  PANEL_SECTIONS,
  PLAY_BUTTON,
  sidebarRow,
  windowTitle,
  wordsTyped,
} from "./parts.ts";
import { halfPast } from "./time.ts";
import { pasteIntoTheCard, renameTab, revisit } from "./visitor.ts";

const HOME_BOX = `${ID.home} ${CLASS.homeAsk} input`;

/** How long a reply that comes in a word at a time has to be all in: it
    takes about three seconds at most. */
const REPLY_IN_WITHIN_MS = 8000;

/** How long Share has to say its own name again after "Copied", in
    milliseconds. */
const SHARE_NAMED_AGAIN_WITHIN_MS = 3000;

const GREETING_PARTS = Object.keys(HOURS.greeting) as GreetingPart[];

test.describe("the home screen", () => {
  for (const part of GREETING_PARTS) {
    const hour = HOURS.greeting[part];

    test(`at ${hour}:30 where the visitor is, the greeting is the site's for the ${part} part of the day`, async ({
      page,
      site,
      visitorZone,
    }) => {
      const greeting = site.greetings[part];
      test.skip(!greeting, `the site has no greeting of its own for the ${part} part of the day`);
      await page.clock.setFixedTime(halfPast(hour, visitorZone));
      await page.goto("./");
      await expect(page.locator(ID.greeting)).toHaveText(greeting ?? "");
    });
  }

  test("has one heading at its top level, the greeting", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveId(PAGE_IDS.greeting);
  });

  test("has one line under the greeting", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator(ID.greeting)).toBeVisible();
    await expect(page.locator(`${ID.home} ${CLASS.intro}`)).toHaveCount(1);
  });

  test("has the details panel beside it, starting with its first section", async ({ page, site }) => {
    await page.goto("./");
    await expect(page.locator(PANEL_SECTIONS).first()).toHaveAttribute("aria-labelledby", site.panel[0] ?? "");
  });

  test("has its box ready to type in", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator(HOME_BOX)).toBeFocused();
  });

  test("is reached from a tab by the name at the top of the sidebar, with its box ready", async ({ page, site }) => {
    await page.goto(site.firstThread.path);
    await page.locator(`${ID.sidebar} ${CLASS.wordmark}`).click();
    await expect(page.locator(HOME_BOX)).toBeFocused();
  });
});

test.describe("a question typed into the home screen's box", () => {
  const QUESTION = "what's the weather like where you are?";

  test.beforeEach(async ({ page, ask }) => {
    await ask.returns(NO_ANSWER);
    await page.goto("./");
    await expect(page.locator(HOME_BOX)).toBeFocused();
    await page.keyboard.type(QUESTION);
    await page.keyboard.press("Enter");
    await expect(page.locator(OPEN_CHAT)).toBeVisible();
  });

  test("starts a new chat with the question as it was typed, and is answered there", async ({ page }) => {
    const question = page.locator(`${OPEN_CHAT} ${CLASS.thread} > ${CLASS.question}`);
    expect(await wordsTyped(question)).toBe(QUESTION);
    await expect(page.locator(`${OPEN_CHAT} ${CLASS.thread} ${EMAIL_LINK}`)).toBeVisible();
  });

  test("is kept as any chat is: under Chats, named after the question", async ({ page }) => {
    await expect(page.locator(CHAT_ROWS).filter({ hasText: QUESTION })).toBeVisible();
  });

  test("leaves the box empty and ready, back on the home screen", async ({ page }) => {
    await page.goBack();
    await expect(page.locator(HOME_BOX)).toBeFocused();
    await expect(page.locator(HOME_BOX)).toHaveValue("");
  });
});

test.describe("a question to start with, clicked on the home screen", () => {
  test.beforeEach(async ({ page, ask, startingPrompt }) => {
    // /ask would fail, and isn't asked: the page knows the answer.
    await ask.returns("fail");
    await page.goto("./");
    await page.locator(`${ID.home} [${DATA.prompt}="${startingPrompt.answer}"]`).first().click();
    await expect(page.locator(OPEN_CHAT)).toBeVisible();
  });

  test("opens a chat that starts with the question, and is named after it", async ({ page, startingPrompt }) => {
    expect(await wordsTyped(page.locator(`${OPEN_CHAT} ${CLASS.thread} > ${CLASS.question}`))).toBe(startingPrompt.q);
    await expect(page.locator(`${OPEN_CHAT} ${CLASS.titleText}`)).toHaveText(startingPrompt.q);
  });

  test("gets the answer it names, word for word, and nothing is asked of /ask", async ({
    page,
    ask,
    startingPrompt,
  }) => {
    const reply = page.locator(`${OPEN_CHAT} ${CLASS.thread} > ${CLASS.answer}`);
    await expect(reply).toBeVisible();
    const answerInItsTab = await textAsRead(answerNamed(page, startingPrompt.answer));
    expect(answerInItsTab, `the page has the answer ${startingPrompt.answer}, in its own tab`).not.toBe("");
    const howTheReplyStarts = (await textAsRead(reply)).slice(0, answerInItsTab.length);
    expect(howTheReplyStarts, "the reply is that answer, word for word").toBe(answerInItsTab);
    expect(ask.requests, "the page names the answer, so /ask isn't asked").toHaveLength(0);
  });

  test("gets its answer a word at a time, every word in the page from the start", async ({ page }) => {
    const reply = page.locator(`${OPEN_CHAT} ${CLASS.thread} > ${CLASS.answer}`).first();
    await expect(reply).toContainClass(PAGE_CLASSES.streaming);
    const words = reply.locator(CLASS.streamed);
    expect(await words.count(), "its words are each a part that comes in at its turn").toBeGreaterThan(1);
    await expect(reply, "once it's all in, it stays in").not.toContainClass(PAGE_CLASSES.streaming, {
      timeout: REPLY_IN_WITHIN_MS,
    });
  });
});

test.describe("a question to start with, with motion reduced", () => {
  test.use({ reducedMotion: "reduce" });

  test("gets its answer whole, at once", async ({ page, ask, startingPrompt }) => {
    await ask.returns("fail");
    await page.goto("./");
    await page.locator(`${ID.home} [${DATA.prompt}="${startingPrompt.answer}"]`).first().click();
    const reply = page.locator(`${OPEN_CHAT} ${CLASS.thread} > ${CLASS.answer}`).first();
    await expect(reply).toBeVisible();
    await expect(reply).not.toContainClass(PAGE_CLASSES.streaming);
    await expect(reply.locator(CLASS.streamed)).toHaveCount(0);
  });
});

test("the skip link goes to the open tab, and leaves it open", async ({ page, site }) => {
  const tab = `#${site.firstThread.id}`;
  await page.goto(site.firstThread.path);
  await expect(openTab(page, site.firstThread.id)).toBeVisible();
  await page.locator(CLASS.skip).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`${tab} :focus`)).toHaveCount(1);
  expect(new URL(page.url()).pathname, "the address is still the tab's").toBe(site.firstThread.path);
  await expect(openTab(page, site.firstThread.id)).toBeVisible();
});

test.describe("a thread renamed", () => {
  const NEW_NAME = "A thread renamed";

  test.beforeEach(async ({ page, site }) => {
    await page.goto(site.secondThread.path);
    await renameTab(page, site.secondThread.id, NEW_NAME);
  });

  test("has its new name in its title, its sidebar row and the window's title", async ({ page, site }) => {
    await expect(page.locator(`#${site.secondThread.id} ${CLASS.titleText}`)).toHaveText(NEW_NAME);
    await expect(sidebarRow(page, site.secondThread.id)).toContainText(NEW_NAME);
    await expect(page).toHaveTitle(windowTitle(NEW_NAME, site));
  });

  test("keeps its new name on the next visit", async ({ page, site }) => {
    await revisit(page, site.secondThread.path);
    await expect(page.locator(`#${site.secondThread.id} ${CLASS.titleText}`)).toHaveText(NEW_NAME);
  });

  test("has its own name again, in its title and its sidebar row, once it's renamed to nothing", async ({
    page,
    site,
  }) => {
    await renameTab(page, site.secondThread.id, "");
    await expect(page.locator(`#${site.secondThread.id} ${CLASS.titleText}`)).toHaveText(site.secondThread.title);
    await expect(sidebarRow(page, site.secondThread.id)).not.toContainText(NEW_NAME);
  });
});

test.describe("copying a tab's link", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test.beforeEach(async ({ page, site }) => {
    await page.goto(site.firstThread.path);
  });

  test("Share copies the link, and says so for a moment", async ({ page, site, baseURL }) => {
    const tab = `#${site.firstThread.id}`;
    const share = page.locator(`${tab} ${ATTRIBUTE.copyLink} ${CLASS.label}`);
    const itsOwnName = (await share.textContent()) ?? "";
    await share.click();
    await expect(share).toHaveText(site.words.copied);
    expect(await pasteIntoTheCard(page, tab)).toBe(new URL(site.firstThread.path, baseURL).href);
    await expect(share).toHaveText(itsOwnName, { timeout: SHARE_NAMED_AGAIN_WITHIN_MS });
  });

  test('"Copy link" in the thread\'s menu says it copied', async ({ page, site }) => {
    await page.locator(`#${site.firstThread.id} ${CLASS.titleMenuButton}`).click();
    await page.locator(`${ID.titleMenu} [${DATA.menuKey}="${MENU_KEYS.copyLink}"]`).click();
    await expect(page.locator(`${CLASS.toast}${CLASS.show}`)).toHaveText(site.words.copied);
  });
});

/** An element's text as it reads, whatever the markup did to its spaces,
    without a Play button's word: that says whether a picture is playing,
    and one in a chat's reply plays by itself once it's on screen. */
const textAsRead = async (element: Locator): Promise<string> =>
  (
    await element.evaluate((shown, button) => {
      const copy = shown.cloneNode(true) as Element;
      for (const word of copy.querySelectorAll(button)) word.remove();
      return copy.textContent;
    }, PLAY_BUTTON)
  )
    .replace(/\s+/g, " ")
    .trim();

/** The answer an id names ("work.2"), where its own tab has it. */
function answerNamed(page: Page, answerId: string): Locator {
  const place = parseAnswerId(answerId);
  if (!place) throw new Error(`"${answerId}" isn't an answer's id`);
  return page.locator(`[id="${place.tabId}"] ${CLASS.thread} > ${CLASS.answer}`).nth(place.answerNumber - 1);
}
