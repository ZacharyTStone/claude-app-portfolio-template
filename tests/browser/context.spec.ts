/* The panel's Context, gathered from the answers: above the config's own
   rows, the links the open tab's answers use, and in a chat those of the
   tabs its answers are from. The home screen, "Something else" and a chat
   with nothing in it list the config's rows alone. Each tab's page is
   built with its own, so it's right with JavaScript off, and the script
   shows each tab's as it moves between them in place. */
import type { Page } from "@playwright/test";
import { onceEach } from "../../src/app/lib/lists.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
} from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import {
  CONTEXT_IN_THE_PANEL,
  EMAIL_LINK,
  firstChatRow,
  GATHERED_LISTS,
  NEW_TAB,
  OPEN_CHAT,
  OWN_CONTEXT_ROWS,
  sidebarRow,
} from "./parts.ts";
import type { GatheredContext, Site } from "./site.ts";
import { askInNewChat, isInTheCard, pickInNewChat, pickTabIn, revisit } from "./visitor.ts";

const SHOWN_LIST = `${GATHERED_LISTS}:not([hidden])`;

type List = GatheredContext["lists"][number];

function listOf(context: GatheredContext, of: string): List {
  const list = context.lists.find((each) => each.of === of);
  if (!list) throw new Error(`The page has no Context list for "${of}"`);
  return list;
}

/** A thread in the sidebar whose answers link out, and one whose don't. */
const threadWithAList = (site: Site, context: GatheredContext) =>
  site.threads.find((thread) => context.lists.some((list) => list.of === thread.id));
const threadWithoutAList = (site: Site, context: GatheredContext) =>
  site.threads.find((thread) => !context.lists.some((list) => list.of === thread.id));

/** Context's own rows show, as the page was built with them. */
async function expectOwnRows(page: Page, context: GatheredContext): Promise<void> {
  await expect(page.locator(OWN_CONTEXT_ROWS)).toHaveText(context.ownRows);
  for (const row of await page.locator(OWN_CONTEXT_ROWS).all()) await expect(row).toBeVisible();
}

/** `list` is the one gathered list that shows, a row for each of its
    links, in order, above Context's own rows. */
async function expectListShown(page: Page, context: GatheredContext, list: List): Promise<void> {
  const shown = page.locator(SHOWN_LIST);
  await expect(shown).toHaveCount(1);
  await expect(shown).toHaveAttribute(DATA.contextOf, list.of);
  await expect(shown.locator("a")).toHaveCount(list.hrefs.length);
  for (const [at, href] of list.hrefs.entries()) {
    await expect(shown.locator("a").nth(at)).toHaveAttribute("href", href);
    await expect(shown.locator("a").nth(at)).toBeVisible();
  }
  await expectOwnRows(page, context);
}

/** No gathered list shows: Context's own rows alone. */
async function expectOwnRowsAlone(page: Page, context: GatheredContext): Promise<void> {
  await expect(page.locator(SHOWN_LIST)).toHaveCount(0);
  await expectOwnRows(page, context);
}

/** Where every row of Context that shows links, its own rows' among them. */
const hrefsShown = (page: Page): Promise<string[]> =>
  page
    .locator(`${CONTEXT_IN_THE_PANEL} a:visible`)
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));

/** The rows of Context that reach past the panel, or past their own
    width. */
const rowsPastThePanel = (page: Page): Promise<number> =>
  page.locator(`${CONTEXT_IN_THE_PANEL} li > :visible`).evaluateAll((rows, panel) => {
    const right = document.querySelector(panel)?.getBoundingClientRect().right ?? 0;
    return rows.filter((row) => row.getBoundingClientRect().right > right || row.scrollWidth > row.clientWidth).length;
  }, ID.panel);

test("the home screen lists Context's own rows alone, none of the links gathered from the answers", async ({
  page,
  gatheredContext,
}) => {
  await page.goto("./");
  await expectOwnRowsAlone(page, gatheredContext);
});

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  test("a tab's page shows that tab's links in Context, and no other tab's", async ({
    page,
    site,
    gatheredContext,
  }) => {
    for (const list of gatheredContext.lists) {
      await test.step(`on ${list.of}'s page`, async () => {
        await page.goto(site.pathOf(list.of));
        await expectListShown(page, gatheredContext, list);
      });
    }
  });

  test("a tab's Context is what its answers link to: each of its rows, and every link to another site", async ({
    page,
    site,
    gatheredContext,
  }) => {
    for (const list of gatheredContext.lists) {
      await test.step(`on ${list.of}'s page`, async () => {
        await page.goto(site.pathOf(list.of));
        const linksInTheTab = page.locator(`[id="${list.of}"] :is(${CLASS.answer}, ${CLASS.question}) a`);
        const hrefsInTheTab = await linksInTheTab.evaluateAll((links) =>
          links.map((link) => link.getAttribute("href") ?? ""),
        );
        for (const href of list.hrefs) expect(hrefsInTheTab, "the tab's links").toContain(href);
        // Another site's: not one on the site's own address, as its canonical link has it.
        const toAnotherSite = await linksInTheTab.evaluateAll((links) => {
          const ownOrigin = new URL(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? "")
            .origin;
          return links
            .filter(
              (link) => link instanceof HTMLAnchorElement && link.target === "_blank" && link.origin !== ownOrigin,
            )
            .map((link) => link.getAttribute("href") ?? "");
        });
        const inContext = await hrefsShown(page);
        for (const href of toAnotherSite) expect(inContext, "the links Context shows").toContain(href);
      });
    }
  });

  test("the home page shows Context's own rows alone", async ({ page, gatheredContext }) => {
    await page.goto("./");
    await expectOwnRowsAlone(page, gatheredContext);
  });

  test("a tab that links nowhere shows Context's own rows alone", async ({ page, site, gatheredContext }) => {
    const thread = threadWithoutAList(site, gatheredContext);
    test.skip(!thread, "every thread in the sidebar links somewhere");
    await page.goto(thread?.path ?? "");
    await expectOwnRowsAlone(page, gatheredContext);
  });
});

test.describe("moving between tabs in place", () => {
  test("Context shows the links of each tab opened, and its own rows alone in a new chat", async ({
    page,
    site,
    gatheredContext,
  }) => {
    const withAList = threadWithAList(site, gatheredContext);
    const withoutAList = threadWithoutAList(site, gatheredContext);
    test.skip(!withAList || !withoutAList, "the sidebar needs a thread that links somewhere and one that doesn't");
    await page.goto("./");
    await sidebarRow(page, withAList?.id ?? "").click();
    await expect(page).toHaveURL(new RegExp(`${withAList?.path ?? ""}$`));
    await expectListShown(page, gatheredContext, listOf(gatheredContext, withAList?.id ?? ""));

    await sidebarRow(page, withoutAList?.id ?? "").click();
    await expectOwnRowsAlone(page, gatheredContext);

    await page.locator(NEW_TAB).click();
    await expect(page.locator(OPEN_CHAT)).toBeVisible();
    await expectOwnRowsAlone(page, gatheredContext);
  });

  test("Back shows the links of the tab it goes back to", async ({ page, site, gatheredContext }) => {
    const withAList = threadWithAList(site, gatheredContext);
    test.skip(!withAList, "no thread in the sidebar links anywhere");
    await page.goto(withAList?.path ?? "");
    await page.locator(NEW_TAB).click();
    await expectOwnRowsAlone(page, gatheredContext);
    await page.goBack();
    await expectListShown(page, gatheredContext, listOf(gatheredContext, withAList?.id ?? ""));
  });
});

/** Two threads the question card can send into a chat, each with a list,
    the second's with a link the first's hasn't: the check is skipped on a
    site without them. */
function twoThreadsToSend(site: Site, context: GatheredContext): [List, List] {
  const lists = context.lists.filter(
    (list) => site.threads.some((thread) => thread.id === list.of) && isInTheCard(site, list.of),
  );
  const [first] = lists;
  const second = lists.find((list) => list.hrefs.some((href) => !first?.hrefs.includes(href)));
  test.skip(!first || !second, "the question card has no two threads whose answers link to different places");
  return [first ?? { of: "", hrefs: [] }, second ?? { of: "", hrefs: [] }];
}

/** The rows a chat lists, as the page builds them: each of the lists'
    links, in order, each address once. */
const linksOfEach = (lists: List[]): string[] =>
  onceEach(
    lists.flatMap((list) => list.hrefs),
    (href) => href,
  );

/** The open chat shows its own list, a row for each of `hrefs`, in order,
    above Context's own rows. */
async function expectChatsList(page: Page, context: GatheredContext, hrefs: string[]): Promise<void> {
  const chatId = (await page.locator(OPEN_CHAT).getAttribute("id")) ?? "";
  await expectListShown(page, context, { of: chatId, hrefs });
}

test.describe("in a chat", () => {
  test('a new chat, and one whose question got "Something else", list Context\'s own rows alone', async ({
    page,
    ask,
    gatheredContext,
  }) => {
    await ask.returns({ id: null });
    await page.goto("./");
    await page.locator(NEW_TAB).click();
    await expect(page.locator(OPEN_CHAT)).toBeVisible();
    await expectOwnRowsAlone(page, gatheredContext);
    await askInNewChat(page, "Anything else?");
    await expect(page.locator(`${OPEN_CHAT} ${EMAIL_LINK}`)).toBeVisible();
    await expectOwnRowsAlone(page, gatheredContext);
  });

  test("Context lists the links of each thread sent into the chat, each once, in the order they came, as each comes in", async ({
    page,
    site,
    gatheredContext,
  }) => {
    const [first, second] = twoThreadsToSend(site, gatheredContext);
    await page.goto("./");
    await pickInNewChat(page, site, first.of);
    await expectChatsList(page, gatheredContext, first.hrefs);
    await pickTabIn(page, site, OPEN_CHAT, second.of);
    await expectChatsList(page, gatheredContext, linksOfEach([first, second]));
  });

  test("a question to start with lists the links of the tab its answer is from", async ({
    page,
    site,
    gatheredContext,
  }) => {
    const prompt = site.prompts.find((each) =>
      gatheredContext.lists.some((list) => each.answer.startsWith(`${list.of}.`)),
    );
    test.skip(!prompt, "no question to start with has an answer from a tab that links anywhere");
    const list = gatheredContext.lists.find((each) => prompt?.answer.startsWith(`${each.of}.`));
    await page.goto("./");
    await page
      .locator(`${ID.home} [${DATA.prompt}="${prompt?.answer ?? ""}"]`)
      .first()
      .click();
    await expectChatsList(page, gatheredContext, list?.hrefs ?? []);
  });

  test("moving from a chat to a tab and back, Context shows each one's links", async ({
    page,
    site,
    gatheredContext,
  }) => {
    const [first, second] = twoThreadsToSend(site, gatheredContext);
    await page.goto("./");
    await pickInNewChat(page, site, first.of);
    await expectChatsList(page, gatheredContext, first.hrefs);
    await sidebarRow(page, second.of).click();
    await expectListShown(page, gatheredContext, second);
    await page.goBack();
    await expectChatsList(page, gatheredContext, first.hrefs);
  });

  test("a chat saved on an earlier visit lists its links again once it's opened", async ({
    page,
    site,
    gatheredContext,
  }) => {
    const [first] = twoThreadsToSend(site, gatheredContext);
    await page.goto("./");
    await pickInNewChat(page, site, first.of);
    await expectChatsList(page, gatheredContext, first.hrefs);
    await revisit(page, "./");
    await expectOwnRowsAlone(page, gatheredContext);
    await firstChatRow(page).click();
    await expectChatsList(page, gatheredContext, first.hrefs);
  });
});

test("every row of Context fits the panel, its words and its address, on each tab", async ({
  page,
  site,
  gatheredContext,
}) => {
  for (const path of gatheredContext.lists.map((list) => site.pathOf(list.of))) {
    await test.step(`at ${path}`, async () => {
      await page.goto(path);
      await expect(page.locator(SHOWN_LIST)).toHaveCount(1);
      expect(await rowsPastThePanel(page), "rows that reach past the panel").toBe(0);
    });
  }
});

/** Logs out, and finds the goodbye lists Context's own links alone. */
async function expectOwnLinksInTheGoodbye(page: Page): Promise<void> {
  const ownLinks = await page
    .locator(OWN_CONTEXT_ROWS)
    .evaluateAll((rows) => rows.filter((row) => row.matches("a")).length);
  await page.locator(CLASS.accountRow).click();
  await page.locator(`${ID.accountMenu} ${ATTRIBUTE.logout}`).click();
  // With none of its own, it has the account menu's email.
  await expect(page.locator(`${CLASS.byeLinks} a`)).toHaveCount(Math.max(ownLinks, 1));
}

test('"Log out" lists Context\'s own links in its goodbye, not the ones gathered from the answers', async ({
  page,
  gatheredContext: _onASiteWithIt,
}) => {
  await page.goto("./");
  await expectOwnLinksInTheGoodbye(page);
});

test('"Log out" from a chat whose answers link out lists Context\'s own links alone too', async ({
  page,
  site,
  gatheredContext,
}) => {
  const [first] = twoThreadsToSend(site, gatheredContext);
  await page.goto("./");
  await pickInNewChat(page, site, first.of);
  await expectChatsList(page, gatheredContext, first.hrefs);
  await expectOwnLinksInTheGoodbye(page);
});

test.describe("on a phone", () => {
  test.use(A_PHONE);

  test("the panel isn't drawn, nor its Context: the page fits the screen without it", async ({
    page,
    gatheredContext: _onASiteWithIt,
  }) => {
    await page.goto("./");
    await expect(page.locator(CONTEXT_IN_THE_PANEL)).toBeHidden();
    const screenWidth = page.viewportSize()?.width ?? 0;
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(screenWidth);
  });
});
