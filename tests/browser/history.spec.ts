/* The GitHub history's parts in an answer: each shows, marked as made from
   what the build fetched, on every language's page; the calendar is a row
   a year whose weeks screen readers skip, and it comes in row by row once
   it's scrolled to, but shows whole without JavaScript or with motion
   reduced; and every part fits a phone's screen. */
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
    await expect(calendar.locator("dd")).toHaveCount(years.length);
    for (const row of await calendar.locator("dd").all()) {
      await expect(row.locator(CLASS.historyStrip)).toHaveAttribute("aria-hidden", "true");
      await expect(row).toContainText(/\d/);
    }
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

  test("the calendar waits, then its rows sweep in one after another once it's scrolled to", async ({
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
    await expect(strips.first()).toHaveCSS("animation-name", "sweep");
    test.skip((await strips.count()) < 2, "the calendar has one row");
    const delays = await strips.evaluateAll((all) =>
      all.slice(0, 2).map((strip) => getComputedStyle(strip).animationDelay),
    );
    expect(parseFloat(delays[1] ?? ""), "the second row comes after the first").toBeGreaterThan(
      parseFloat(delays[0] ?? ""),
    );
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
    await expect(calendar.locator(CLASS.historyStrip).first()).toHaveCSS("animation-name", "none");
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
