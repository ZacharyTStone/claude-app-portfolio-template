/* The globe behind the home screen's text, on a site with one (the
   config's `globe`): it turns to where its owner is and marks it with the
   time there, at once with motion reduced, and isn't there at all without
   the script. */
import type { Page } from "@playwright/test";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import { CLASS_SELECTOR as CLASS } from "../../src/contracts/page-selectors.ts";
import { expect, test } from "./fixtures.ts";
import type { Globe } from "./site.ts";

/** The turn takes under three seconds; this leaves it room on a slow machine. */
const LANDS_WITHIN_MS = 8000;
/** With motion reduced there's no turn: only the land to load. */
const SHOWS_AT_ONCE_WITHIN_MS = 2000;

const GLOBE = CLASS.globe;
const MARKER = `${GLOBE} ${CLASS.globeMarker}`;

const timeThere = async (page: Page, { zone }: Globe): Promise<string> =>
  page.evaluate(
    (timeZone) =>
      new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date()),
    zone,
  );

/** How many of the canvas's pixels something is drawn on. */
const pixelsDrawn = (page: Page): Promise<number> =>
  page.locator(`${GLOBE} canvas`).evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) return 0;
    const { data } = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height) ?? { data: [] };
    let drawn = 0;
    for (let alpha = 3; alpha < data.length; alpha += 4) if (data[alpha]) drawn++;
    return drawn;
  });

test.describe("the home screen's globe", () => {
  test("turns to where the owner is, and marks it with the time there", async ({ page, globe }) => {
    await page.goto("./");
    await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
    await expect(page.locator(MARKER)).toBeVisible();
    await expect(page.locator(`${MARKER} ${CLASS.globeTime}`)).toHaveText(await timeThere(page, globe));
  });

  test("names the place before the time", async ({ page, globe }) => {
    test.skip(!globe.place, "the globe's marker names no place");
    await page.goto("./");
    await expect(page.locator(MARKER)).toHaveText(new RegExp(`^${globe.place}`));
  });

  test("is drawn on its canvas under the text", async ({ page, globe: _globe }) => {
    await page.goto("./");
    await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
    expect(await pixelsDrawn(page)).toBeGreaterThan(1000);
  });

  test.describe("with motion reduced", () => {
    test.use({ reducedMotion: "reduce" });

    test("has already turned when the home screen shows", async ({ page, globe: _globe }) => {
      await page.goto("./");
      await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: SHOWS_AT_ONCE_WITHIN_MS });
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("isn't there", async ({ page, globe: _globe }) => {
      await page.goto("./");
      await expect(page.locator(GLOBE)).toBeHidden();
    });
  });
});
