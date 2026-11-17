/* The panel's Context, gathered from the answers: above the config's own
   rows, the links the open tab's answers use, and on the home screen and in
   a chat every link on the site. Each tab's page is built with its own, so
   it's right with JavaScript off, and the script shows each tab's as it
   moves between them in place. */
import type { Page } from "@playwright/test";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { PAGE_IDS } from "../../src/contracts/page-ids.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
} from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import { CONTEXT_IN_THE_PANEL, GATHERED_LISTS, NEW_TAB, OPEN_CHAT, OWN_CONTEXT_ROWS, sidebarRow } from "./parts.ts";
import type { GatheredContext, Site } from "./site.ts";

const SHOWN_LIST = `${GATHERED_LISTS}:not([hidden])`;

type List = GatheredContext["lists"][number];

function listOf(context: GatheredContext, of: string): List {
  const list = context.lists.find((each) => each.of === of);
  if (!list) throw new Error(`The page has no Context list for "${of}"`);
  return list;
}

/** The tabs with a list of their own, but for the home screen. */
const tabLists = (context: GatheredContext): List[] => context.lists.filter((list) => list.of !== PAGE_IDS.home);

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

test("the home screen lists every link on the site, once each, above Context's own rows", async ({
  page,
  gatheredContext,
}) => {
  await page.goto("./");
  const home = listOf(gatheredContext, PAGE_IDS.home);
  await expectListShown(page, gatheredContext, home);
  expect(new Set(home.hrefs).size, "each link is listed once").toBe(home.hrefs.length);
  for (const list of tabLists(gatheredContext)) {
    for (const href of list.hrefs) expect(home.hrefs, `the home screen's list has ${list.of}'s links`).toContain(href);
  }
});

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  test("a tab's page shows that tab's links in Context, and no other tab's", async ({
    page,
    site,
    gatheredContext,
  }) => {
    for (const list of tabLists(gatheredContext)) {
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
    for (const list of tabLists(gatheredContext)) {
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

  test("a tab that links nowhere shows Context's own rows alone", async ({ page, site, gatheredContext }) => {
    const thread = threadWithoutAList(site, gatheredContext);
    test.skip(!thread, "every thread in the sidebar links somewhere");
    await page.goto(thread?.path ?? "");
    await expectOwnRowsAlone(page, gatheredContext);
  });
});

test.describe("moving between tabs in place", () => {
  test("Context shows the links of each tab opened, and the home screen's in a new chat", async ({
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
    await expectListShown(page, gatheredContext, listOf(gatheredContext, PAGE_IDS.home));
  });

  test("Back shows the links of the tab it goes back to", async ({ page, site, gatheredContext }) => {
    const withAList = threadWithAList(site, gatheredContext);
    test.skip(!withAList, "no thread in the sidebar links anywhere");
    await page.goto(withAList?.path ?? "");
    await page.locator(NEW_TAB).click();
    await expectListShown(page, gatheredContext, listOf(gatheredContext, PAGE_IDS.home));
    await page.goBack();
    await expectListShown(page, gatheredContext, listOf(gatheredContext, withAList?.id ?? ""));
  });
});

test("every row of Context fits the panel, its words and its address, on the home screen and each tab", async ({
  page,
  site,
  gatheredContext,
}) => {
  for (const path of ["./", ...tabLists(gatheredContext).map((list) => site.pathOf(list.of))]) {
    await test.step(`at ${path}`, async () => {
      await page.goto(path);
      await expect(page.locator(SHOWN_LIST)).toHaveCount(1);
      expect(await rowsPastThePanel(page), "rows that reach past the panel").toBe(0);
    });
  }
});

test('"Log out" lists Context\'s own links in its goodbye, not the ones gathered from the answers', async ({
  page,
  gatheredContext: _onASiteWithIt,
}) => {
  await page.goto("./");
  const ownLinks = await page
    .locator(OWN_CONTEXT_ROWS)
    .evaluateAll((rows) => rows.filter((row) => row.matches("a")).length);
  await page.locator(CLASS.accountRow).click();
  await page.locator(`${ID.accountMenu} ${ATTRIBUTE.logout}`).click();
  // With none of its own, it has the account menu's email.
  await expect(page.locator(`${CLASS.byeLinks} a`)).toHaveCount(Math.max(ownLinks, 1));
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
