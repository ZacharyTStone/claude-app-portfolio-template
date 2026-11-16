/* The Writing tab: the posts the build fetched, a card each, under the tab's
   own question, on every language's page; with JavaScript on and off, and
   on a phone. A card links to the post's own page, which the checks never
   open: they never use the network. */
import type { Page } from "@playwright/test";
import { WRITING_TAB } from "../../src/config/writing.ts";
import { threadAnswerId } from "../../src/contracts/ask.ts";
import { ATTRIBUTE_SELECTOR as ATTRIBUTE, CLASS_SELECTOR as CLASS } from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import { OPEN_CHAT, OPEN_DRAWER, sentInto, sidebarRow, windowTitle } from "./parts.ts";
import type { WritingTab } from "./site.ts";
import { askIn } from "./visitor.ts";

const OPEN_TAB = `#${WRITING_TAB}:target`;

const cardsIn = (page: Page) => page.locator(`#${WRITING_TAB} ${ATTRIBUTE.fetched}`);

/** The tab shows its question, then a card for each post, in the order the
    build listed them, each linking to the post's page. */
async function expectTheTab(page: Page, writingTab: WritingTab): Promise<void> {
  const tab = page.locator(OPEN_TAB);
  await expect(tab).toBeVisible();
  await expect(tab.locator(CLASS.question).first()).toContainText(writingTab.questions[0] ?? "");
  await expect(cardsIn(page)).toHaveCount(writingTab.posts.length);
  for (const [at, post] of writingTab.posts.entries()) {
    await expect(cardsIn(page).nth(at)).toHaveAttribute("href", post.href);
  }
  await expect(cardsIn(page).first()).toBeVisible();
}

test.describe("the Writing tab, opened from its row in the sidebar", () => {
  test.beforeEach(async ({ page, writingTab: _onASiteWithOne }) => {
    await page.goto("./");
    await sidebarRow(page, WRITING_TAB).click();
  });

  test("shows its question, then every post's card in the order the build listed them", async ({
    page,
    writingTab,
  }) => {
    await expectTheTab(page, writingTab);
  });

  test("is named in its top bar and in the window's title", async ({ page, site, writingTab }) => {
    await expect(page.locator(`${OPEN_TAB} ${CLASS.title}`)).toContainText(writingTab.title);
    await expect(page).toHaveTitle(windowTitle(writingTab.title, site));
  });

  test("opens a post in a new tab, and tells its site nothing of where the visitor came from", async ({ page }) => {
    for (const card of await cardsIn(page).all()) {
      await expect(card).toHaveAttribute("target", "_blank");
      await expect(card).toHaveAttribute("rel", /\bnoreferrer\b/);
    }
  });
});

test("a post's card says what the build listed: its title, then the day, its LGTMs and its tags", async ({
  page,
  writingTab,
}) => {
  await page.goto(`#${WRITING_TAB}`);
  for (const [at, post] of writingTab.posts.entries()) await expect(cardsIn(page).nth(at)).toHaveText(post.text);
});

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  test("the tab is at its address, with every post's card", async ({ page, writingTab }) => {
    await page.goto(`#${WRITING_TAB}`);
    await expectTheTab(page, writingTab);
  });

  test("its row in the sidebar opens it", async ({ page, writingTab }) => {
    await page.goto("./");
    await sidebarRow(page, WRITING_TAB).click();
    await expectTheTab(page, writingTab);
  });
});

test.describe("on a phone", () => {
  test.use(A_PHONE);

  test("its row in the drawer opens the tab, and the drawer closes", async ({ page, writingTab }) => {
    await page.goto("./");
    await page.locator(`${OPEN_CHAT} ${CLASS.menuButton}`).click();
    await page.locator(`${OPEN_DRAWER} a[href="#${WRITING_TAB}"]`).click();
    await expectTheTab(page, writingTab);
    await expect(page.locator(OPEN_DRAWER)).toHaveCount(0);
  });

  test("every card fits the screen, its title and all", async ({ page, writingTab }) => {
    await page.goto(`#${WRITING_TAB}`);
    await expect(cardsIn(page)).toHaveCount(writingTab.posts.length);
    const screenWidth = page.viewportSize()?.width ?? 0;
    const pastTheScreen = await cardsIn(page).evaluateAll(
      (cards, width) =>
        cards.filter((card) => card.getBoundingClientRect().right > width || card.scrollWidth > card.clientWidth)
          .length,
      screenWidth,
    );
    expect(pastTheScreen, `cards that reach past the screen's ${screenWidth}px`).toBe(0);
  });
});

test("every other language's page has the same posts in its Writing tab, in its own words", async ({
  page,
  site,
  writingTab,
}) => {
  test.skip(!site.languages.length, "the site is in one language");
  for (const language of site.languages) {
    await test.step(`on the ${language.lang} page`, async () => {
      await page.goto(`${language.href}#${WRITING_TAB}`);
      await expect(page.locator("html")).toHaveAttribute("lang", language.lang);
      await expect(page.locator(OPEN_TAB)).toBeVisible();
      await expect(cardsIn(page)).toHaveCount(writingTab.posts.length);
      for (const [at, post] of writingTab.posts.entries()) {
        await expect(cardsIn(page).nth(at)).toHaveAttribute("href", post.href);
      }
      const ownName = (await sidebarRow(page, WRITING_TAB).textContent())?.trim() ?? "";
      await expect(page.locator(`${OPEN_TAB} ${CLASS.title}`)).toHaveText(ownName);
    });
  }
});

test("a question Ask answers from the Writing tab gets its reply, then a link to the tab", async ({
  page,
  site,
  ask,
  writingTab,
}) => {
  test.skip(!site.ask, "Ask is off");
  await ask.returns({ id: threadAnswerId(WRITING_TAB, 1), reply: "Yes, now and then." });
  await page.goto(`#${site.firstThread.id}`);
  await askIn(page, site.firstThread.id, "Does this person write?");
  const sent = sentInto(page, site.firstThread.id);
  await expect(sent.answers.last()).toContainText("Yes, now and then.");
  await expect(sent.whereFrom.locator(`a[href="#${WRITING_TAB}"]`)).toContainText(writingTab.title);
});
