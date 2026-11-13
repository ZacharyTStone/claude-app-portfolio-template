/* The question card over every tab's composer, and what's sent from it: a
   question typed in, or a choice. /ask is stood in for with no answer, as
   it is on a site with Ask off. */
import type { Locator, Page } from "@playwright/test";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import { personalTabId } from "../../src/contracts/page-ids.ts";
import { CLASS_SELECTOR as CLASS, ID_SELECTOR as ID } from "../../src/contracts/page-selectors.ts";
import { expect, NO_ANSWER, test } from "./fixtures.ts";
import { NEW_TAB, OPEN_CARD, OPEN_CHAT, sentInto, sidebarRow, wordsTyped } from "./parts.ts";
import { tabIdOf } from "./site.ts";
import { askIn, askInNewChat, firstTabChoice, pickFirstTab } from "./visitor.ts";

// A "$&" would be a pattern in a careless replace: it stays as typed.
const A_QUESTION_WITH_A_PATTERN_IN_IT = "Does he like natto? It costs $& here";

test.describe("a question typed into one of the site's own tabs", () => {
  test.beforeEach(async ({ page, site, ask }) => {
    await ask.returns(NO_ANSWER);
    await page.goto(`#${site.firstThread.id}`);
  });

  test("is sent, and answered there", async ({ page, site }) => {
    const question = "Have you worked with Postgres at scale?";
    await askIn(page, site.firstThread.id, question);
    const sent = sentInto(page, site.firstThread.id);
    await expect(sent.questions.filter({ hasText: question })).toBeVisible();
    await expect(sent.emailLinks.last()).toBeVisible();
  });

  test("is in its bubble and in the email exactly as it was typed", async ({ page, site }) => {
    await askIn(page, site.firstThread.id, A_QUESTION_WITH_A_PATTERN_IN_IT);
    const sent = sentInto(page, site.firstThread.id);
    await expect(sent.emailLinks).toBeVisible();
    expect(await wordsTyped(sent.questions.last())).toBe(A_QUESTION_WITH_A_PATTERN_IN_IT);
    const email = decodeURIComponent((await sent.emailLinks.getAttribute("href")) ?? "");
    expect(email).toContain(A_QUESTION_WITH_A_PATTERN_IN_IT);
  });

  test("is in the message to copy exactly as it was typed", async ({ page, site }) => {
    await askIn(page, site.firstThread.id, A_QUESTION_WITH_A_PATTERN_IN_IT);
    const sent = sentInto(page, site.firstThread.id);
    await expect(sent.emailLinks).toBeVisible();
    const message = sent.everything.locator(CLASS.draftText);
    test.skip((await message.count()) === 0, "the site has no message to copy");
    await expect(message).toContainText(A_QUESTION_WITH_A_PATTERN_IN_IT);
  });

  test("stays there with its reply until another tab opens", async ({ page, site, otherThread }) => {
    await askIn(page, site.firstThread.id, "Could you start in spring?");
    const sent = sentInto(page, site.firstThread.id);
    await expect(sent.answers.first()).toBeVisible();
    await sidebarRow(page, otherThread.id).click();
    await sidebarRow(page, site.firstThread.id).click();
    await expect(sent.everything).toHaveCount(0);
  });
});

test.describe("questions sent one after another in a chat", () => {
  const QUESTION = PAGE_CLASSES.question;
  const ANSWER = PAGE_CLASSES.answer;

  let chatId: string;

  test.beforeEach(async ({ page, ask }) => {
    await ask.returns(NO_ANSWER);
    await page.goto("./");
    await askInNewChat(page, "First?");
    chatId = (await page.locator(OPEN_CHAT).getAttribute("id")) ?? "";
    await askIn(page, chatId, "Second?");
  });

  test("each get their reply, in order, when one is sent before the last reply is in", async ({ page }) => {
    await expect.poll(() => kindOfEachMessage(page)).toEqual([QUESTION, ANSWER, QUESTION, ANSWER]);
  });

  test("are all there with their replies when the chat is left before a reply is in, and come back to", async ({
    page,
    otherThread,
  }) => {
    await expect.poll(() => kindOfEachMessage(page)).toEqual([QUESTION, ANSWER, QUESTION, ANSWER]);
    await askIn(page, chatId, "Third?");
    await sidebarRow(page, otherThread.id).click();
    await expect(page.locator(`#${otherThread.id}:target`)).toBeVisible();
    await sidebarRow(page, chatId).click();
    await expect.poll(() => kindOfEachMessage(page)).toEqual([QUESTION, ANSWER, QUESTION, ANSWER, QUESTION, ANSWER]);
  });
});

test.describe("a choice from the card", () => {
  test("in one of the site's own tabs, opens its tab: nothing is sent, and the card closes", async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
    await page.locator(`#${site.firstThread.id} ${CLASS.composer}`).click();
    const choice = await firstTabChoice(page);
    const itsTab = tabIdOf(await choice.getAttribute("href"));
    // What's sent into a site's tab goes when another opens, so it's counted in the click, before the tab changes.
    expect(await clickAndCount(choice, `${CLASS.thread} > ${CLASS.sent}`), "what's sent anywhere, at the click").toBe(
      0,
    );
    await expect(page.locator(`#${itsTab}:target`)).toBeVisible();
    await expect(page.locator(ID.questionCard)).toBeHidden();
  });

  test("in a chat, is sent as a message: that thread's first question, then its answers", async ({ page, site }) => {
    await page.goto("./");
    await page.locator(NEW_TAB).click();
    await expect(page.locator(OPEN_CARD)).toBeVisible();
    const chosen = await pickFirstTab(page);
    const itsFirstQuestion = site.threads.find((thread) => thread.id === chosen)?.questions[0] ?? "";
    const chat = page.locator(OPEN_CHAT);
    const sentQuestions = chat.locator(`${CLASS.thread} > ${CLASS.question}${CLASS.sent}`);
    await expect(sentQuestions.filter({ hasText: itsFirstQuestion })).toBeVisible();
    await expect(chat.locator(`${CLASS.thread} > ${CLASS.answer}${CLASS.sent}`).first()).toBeVisible();
    await expect(sentQuestions, "only the question that was chosen").toHaveCount(1);
  });
});

test.describe("personal answers", () => {
  test("the card's personal topic lists the ones that aren't hidden", async ({ page, site }) => {
    const { personalTopic, shownAnswers, hiddenAnswers } = site;
    test.skip(!personalTopic, "the question card has no personal topic");
    test.skip(!hiddenAnswers.length, "there are no hidden personal answers");
    test.skip(shownAnswers.length < 2, "the personal topic has fewer than two answers to list");
    await page.goto(`#${site.firstThread.id}`);
    await page.locator(`#${site.firstThread.id} ${CLASS.composer}`).click();
    const card = page.locator(ID.questionCard);
    await card
      .locator(`${CLASS.options} li > *`)
      .filter({ has: page.getByText(personalTopic?.label ?? "", { exact: true }) })
      .click();
    await expect(card.locator(`${CLASS.options} ${CLASS.optionLabel}`)).toHaveText(
      shownAnswers.map((answer) => answer.q),
    );
  });

  test("a hidden one still has a tab, for Ask to pick", async ({ page, site }) => {
    test.skip(!site.hiddenAnswers.length, "there are no hidden personal answers");
    await page.goto("./");
    for (const hidden of site.hiddenAnswers) {
      await expect(
        page.locator(`#${personalTabId(hidden.id)}`),
        `the hidden answer ${hidden.id} has a tab`,
      ).toHaveCount(1);
    }
  });
});

/** What each message in the open chat is, in order: a question or an answer. */
const kindOfEachMessage = (page: Page): Promise<string[]> =>
  page
    .locator(`${OPEN_CHAT} ${CLASS.thread} > *`)
    .evaluateAll((messages) => messages.map((message) => message.classList.item(0) ?? ""));

/** Clicks a link in the page, and says how many elements match `selector`
    by the time the click has been handled. */
const clickAndCount = (link: Locator, selector: string): Promise<number> =>
  link.evaluate((element, counted) => {
    (element as HTMLElement).click();
    return document.querySelectorAll(counted).length;
  }, selector);
