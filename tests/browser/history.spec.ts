/* The GitHub history's parts in an answer: each shows, marked as made from
   what the build fetched, on every language's page; the calendar is a row
   a year whose weeks screen readers skip, with its repos' names as links
   whose dots in the row light with them; it plays row by row once it's
   scrolled to, and the stats' counts climb, but every part shows whole
   without JavaScript or with motion reduced; and every part fits a
   phone's screen. */
import type { Locator, Page } from "@playwright/test";
import type { GitHubPart } from "../../src/config/github-history.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import { ATTRIBUTE_SELECTOR as ATTRIBUTE, CLASS_SELECTOR as CLASS } from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import type { GitHubHistory } from "./site.ts";

/** A part of the history, in its tab. */
const partIn = (page: Page, tab: string, part: GitHubPart): Locator =>
  page.locator(`#${tab} [${DATA.githubPart}="${part}"]`);

/** The calendar, in the tab the history is in. The check is skipped on a
    site whose answers show no calendar. */
function calendarOf(page: Page, history: GitHubHistory): Locator {
  test.skip(!history.parts.includes("calendar"), "the GitHub history has no calendar");
  return partIn(page, history.tab, "calendar");
}

/** Where an element ends on the right, in the page's pixels: NaN, which no
    check passes on, for one that isn't on the page. */
async function rightEdgeOf(element: Locator): Promise<number> {
  const box = await element.boundingBox();
  return box ? box.x + box.width : NaN;
}

/** Half a pixel: what a browser's rounding can put one box past another. */
const A_ROUNDING = 0.5;

/** A window so short that the calendar is below it. */
const A_SHORT_WINDOW = { width: 1440, height: 420 };

test.describe("in its tab", () => {
  test.beforeEach(async ({ page, site, githubHistory }) => {
    await page.goto(site.pathOf(githubHistory.tab));
  });

  test("each part of the history shows where the answer has it, marked as made from what the build fetched", async ({
    page,
    githubHistory,
  }) => {
    const { tab, parts } = githubHistory;
    for (const part of parts) {
      const figure = partIn(page, tab, part);
      await figure.scrollIntoViewIfNeeded();
      await expect(figure).toBeVisible();
      await expect(figure).toHaveAttribute(DATA.fetched, "");
    }
  });

  test("the calendar has a row a year, oldest first, each with its total, and a strip of weeks screen readers skip", async ({
    page,
    githubHistory,
  }) => {
    const calendar = calendarOf(page, githubHistory);
    const years = githubHistory.years.map(Number);
    expect(years.length, "the calendar has a year").toBeGreaterThan(0);
    expect(years).toEqual(years.toSorted((one, other) => one - other));
    await expect(calendar.locator("dt")).toHaveCount(years.length);
    for (const row of await calendar.locator(`dd:has(${CLASS.historyStrip})`).all()) {
      await expect(row.locator(CLASS.historyStrip)).toHaveAttribute("aria-hidden", "true");
      await expect(row).toContainText(/\d/);
    }
  });

  test("each repo under a row is a link to it on GitHub, and its dot in the row the same link, out of the keyboard's way; pointing at either lights both", async ({
    page,
    githubHistory,
  }) => {
    const calendar = calendarOf(page, githubHistory);
    const names = calendar.locator(`${CLASS.historyRepos} a`);
    test.skip(!(await names.count()), "the calendar shows no repos");
    await calendar.scrollIntoViewIfNeeded();
    for (const name of await names.all()) {
      const address = (await name.getAttribute("href")) ?? "";
      expect(address).toMatch(/^https:\/\/github\.com\/[^/]+\/[\w.-]+$/);
      await expect(name).toHaveText(address.split("/").at(-1) ?? "");
    }
    const first = names.first();
    const dot = calendar.locator(`${CLASS.historyPins} a[href="${await first.getAttribute("href")}"]`);
    await expect(dot).toHaveAttribute("tabindex", "-1");
    await expect(dot.locator(`xpath=ancestor::*[@aria-hidden="true"]`)).toHaveCount(1);
    await first.hover();
    await expect(dot).toContainClass(PAGE_CLASSES.lit);
    await page.mouse.move(0, 0);
    await expect(dot).not.toContainClass(PAGE_CLASSES.lit);
  });

  test("the stats' numbers are set large in the serif", async ({ page, githubHistory }) => {
    test.skip(!githubHistory.parts.includes("stats"), "the GitHub history has no stats");
    const number = partIn(page, githubHistory.tab, "stats").locator("dd b").first();
    await expect(number).toHaveCSS("font-family", /Source Serif 4/);
  });

  test("the rhythm has a bar for each of the seven days of the week", async ({ page, githubHistory }) => {
    test.skip(!githubHistory.parts.includes("rhythm"), "the GitHub history has no rhythm");
    await expect(partIn(page, githubHistory.tab, "rhythm").locator("dt")).toHaveCount(7);
  });
});

test.describe("below a short window", () => {
  test.use({ viewport: A_SHORT_WINDOW });

  test("the calendar waits, then plays its rows one after another once it's scrolled to, its weeks popping in as a line crosses them", async ({
    page,
    site,
    githubHistory,
  }) => {
    await page.goto(site.pathOf(githubHistory.tab));
    const calendar = calendarOf(page, githubHistory);
    await expect(calendar).toContainClass(PAGE_CLASSES.waiting);
    await calendar.scrollIntoViewIfNeeded();
    await expect(calendar).toContainClass(PAGE_CLASSES.seen);
    await expect(calendar).toHaveCSS("opacity", "1");
    const strips = calendar.locator(CLASS.historyStrip);
    const firstWeeks = calendar.locator(`${CLASS.historyStrip} > i:first-child`);
    await expect(firstWeeks.first()).toHaveCSS("animation-name", "week-in");
    expect(await strips.first().evaluate((strip) => getComputedStyle(strip, "::after").animationName)).toBe("cross");
    test.skip((await strips.count()) < 2, "the calendar has one row");
    const delays = await firstWeeks.evaluateAll((all) =>
      all.slice(0, 2).map((week) => getComputedStyle(week).animationDelay),
    );
    expect(parseFloat(delays[1] ?? ""), "the second row comes after the first").toBeGreaterThan(
      parseFloat(delays[0] ?? ""),
    );
  });

  test("the stats come in once they're scrolled to, each count climbing to the number the page was built with", async ({
    page,
    site,
    githubHistory,
  }) => {
    test.skip(!githubHistory.parts.includes("stats"), "the GitHub history has no stats");
    await page.goto(site.pathOf(githubHistory.tab));
    const stats = partIn(page, githubHistory.tab, "stats");
    await expect(stats).toContainClass(PAGE_CLASSES.waiting);
    const count = stats.locator(ATTRIBUTE.count).first();
    const built = (await count.textContent()) ?? "";
    await stats.scrollIntoViewIfNeeded();
    await expect.poll(() => count.textContent(), { intervals: [50] }).not.toBe(built);
    await expect(count).toHaveText(built);
  });
});

test.describe("with motion reduced", () => {
  test.use({ viewport: A_SHORT_WINDOW, reducedMotion: "reduce" });

  test("the calendar shows whole from the start: nothing waits, and no row sweeps in", async ({
    page,
    site,
    githubHistory,
  }) => {
    await page.goto(site.pathOf(githubHistory.tab));
    const calendar = calendarOf(page, githubHistory);
    await expect(page.locator(`html${CLASS.js}`)).toBeVisible();
    await expect(page.locator(CLASS.waiting)).toHaveCount(0);
    await expect(calendar).toHaveCSS("opacity", "1");
    await calendar.scrollIntoViewIfNeeded();
    await expect(calendar.locator(`${CLASS.historyStrip} > i`).first()).toHaveCSS("animation-name", "none");
    await expect(calendar.locator(CLASS.historyStrip).first()).toHaveCSS("clip-path", "none");
  });
});

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  test("every part shows whole, the calendar's rows with nothing hidden", async ({ page, site, githubHistory }) => {
    await page.goto(site.pathOf(githubHistory.tab));
    for (const part of githubHistory.parts) await expect(partIn(page, githubHistory.tab, part)).toBeVisible();
    const calendar = calendarOf(page, githubHistory);
    await expect(calendar).toHaveCSS("opacity", "1");
    await expect(calendar.locator(CLASS.historyStrip).first()).toHaveCSS("clip-path", "none");
  });
});

test.describe("on a phone", () => {
  test.use(A_PHONE);

  test("every part fits the screen, the calendar's weeks smaller, and the page doesn't scroll sideways", async ({
    page,
    site,
    githubHistory,
  }) => {
    await page.goto(site.pathOf(githubHistory.tab));
    const screenWidth = page.viewportSize()?.width ?? 0;
    for (const part of githubHistory.parts) {
      const figure = partIn(page, githubHistory.tab, part);
      await figure.scrollIntoViewIfNeeded();
      expect(await rightEdgeOf(figure), `the ${part} ends within the screen`).toBeLessThanOrEqual(screenWidth);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(screenWidth);
  });

  test("the calendar's last week ends within its row", async ({ page, site, githubHistory }) => {
    await page.goto(site.pathOf(githubHistory.tab));
    const calendar = calendarOf(page, githubHistory);
    await calendar.scrollIntoViewIfNeeded();
    const strip = calendar.locator(CLASS.historyStrip).first();
    const lastWeek = strip.locator("i").last();
    expect((await lastWeek.boundingBox())?.width, "a week is drawn").toBeGreaterThan(1);
    expect(await rightEdgeOf(lastWeek)).toBeLessThanOrEqual((await rightEdgeOf(strip)) + A_ROUNDING);
  });
});

test("every other language's page has the same parts, and the calendar the same years", async ({
  page,
  site,
  githubHistory,
}) => {
  test.skip(!site.languages.length, "the site is in one language");
  for (const language of site.languages) {
    await test.step(`on the ${language.lang} page`, async () => {
      await page.goto(language.href);
      const tab = page.locator(`#${githubHistory.tab}`);
      await expect(tab.locator(ATTRIBUTE.githubPart)).toHaveCount(githubHistory.parts.length);
      await expect(tab.locator(`${CLASS.historyCalendar} dt`)).toHaveText(githubHistory.years);
    });
  }
});
