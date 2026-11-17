/* The panel's GitHub activity: the public repos the build fetched, a row
   each, last in the details panel, on every language's page; with
   JavaScript on and off, and on a phone, where the panel isn't drawn. A row
   links to the repo on GitHub, which the checks never open: they never use
   the network. */
import type { Page } from "@playwright/test";
import { ATTRIBUTE_SELECTOR as ATTRIBUTE, ID_SELECTOR as ID } from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import { ACTIVITY_IN_THE_PANEL, PANEL_SECTIONS } from "./parts.ts";
import type { GitHubActivity } from "./site.ts";

const rowsIn = (page: Page) => page.locator(`${ACTIVITY_IN_THE_PANEL} ${ATTRIBUTE.fetched}`);

/** The section shows under its heading, after every other, with a row for
    each repo, in the order the build listed them, each linking to it. */
async function expectTheSection(page: Page, activity: GitHubActivity): Promise<void> {
  const section = page.locator(ACTIVITY_IN_THE_PANEL);
  await expect(section).toBeVisible();
  await expect(section.locator("h2")).toHaveText(activity.title);
  await expect(page.locator(PANEL_SECTIONS).last()).toHaveAttribute(
    "aria-labelledby",
    (await section.getAttribute("aria-labelledby")) ?? "",
  );
  await expect(rowsIn(page)).toHaveCount(activity.repos.length);
  for (const [at, repo] of activity.repos.entries()) {
    await expect(rowsIn(page).nth(at)).toHaveAttribute("href", repo.href);
    await expect(rowsIn(page).nth(at)).toBeVisible();
  }
}

test("the panel lists the recent public repos last, each a row that links to it", async ({ page, githubActivity }) => {
  await page.goto("./");
  await expectTheSection(page, githubActivity);
});

test("a repo's row says what the build listed: its name, then the day it was pushed to", async ({
  page,
  githubActivity,
}) => {
  await page.goto("./");
  for (const [at, repo] of githubActivity.repos.entries()) await expect(rowsIn(page).nth(at)).toHaveText(repo.text);
});

test("a repo opens in a new tab, and GitHub is told nothing of where the visitor came from", async ({
  page,
  githubActivity: _onASiteWithIt,
}) => {
  await page.goto("./");
  for (const row of await rowsIn(page).all()) {
    await expect(row).toHaveAttribute("target", "_blank");
    await expect(row).toHaveAttribute("rel", /\bnoreferrer\b/);
  }
});

test("every row fits the panel, its name and its day", async ({ page, githubActivity }) => {
  await page.goto("./");
  await expect(rowsIn(page)).toHaveCount(githubActivity.repos.length);
  const pastThePanel = await rowsIn(page).evaluateAll((rows, panel) => {
    const right = document.querySelector(panel)?.getBoundingClientRect().right ?? 0;
    return rows.filter((row) => row.getBoundingClientRect().right > right || row.scrollWidth > row.clientWidth).length;
  }, ID.panel);
  expect(pastThePanel, "rows that reach past the panel").toBe(0);
});

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  test("the panel lists the same repos, each a row that links to it", async ({ page, githubActivity }) => {
    await page.goto("./");
    await expectTheSection(page, githubActivity);
  });
});

test.describe("on a phone", () => {
  test.use(A_PHONE);

  test("the panel isn't drawn, and nor are the repos: the page fits the screen without them", async ({
    page,
    githubActivity: _onASiteWithIt,
  }) => {
    await page.goto("./");
    await expect(page.locator(ACTIVITY_IN_THE_PANEL)).toBeHidden();
    const screenWidth = page.viewportSize()?.width ?? 0;
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(screenWidth);
  });
});

test("every other language's page lists the same repos, under its own heading", async ({
  page,
  site,
  githubActivity,
}) => {
  test.skip(!site.languages.length, "the site is in one language");
  for (const language of site.languages) {
    await test.step(`on the ${language.lang} page`, async () => {
      await page.goto(language.href);
      await expect(page.locator("html")).toHaveAttribute("lang", language.lang);
      await expect(page.locator(`${ACTIVITY_IN_THE_PANEL} h2`)).not.toHaveText("");
      await expect(rowsIn(page)).toHaveCount(githubActivity.repos.length);
      for (const [at, repo] of githubActivity.repos.entries()) {
        await expect(rowsIn(page).nth(at)).toHaveAttribute("href", repo.href);
      }
    });
  }
});
