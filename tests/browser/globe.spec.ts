/* The globe behind the home screen's text, on a site with one (the
   config's `globe`): it turns to where its owner is and marks it with the
   time there, at once with motion reduced, and isn't there at all without
   the script. */
import type { Page } from "@playwright/test";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import { CLASS_SELECTOR as CLASS } from "../../src/contracts/page-selectors.ts";
import { expect, test, VISITS_STAND_IN } from "./fixtures.ts";
import type { Globe } from "./site.ts";

/** The turn takes under three seconds; this leaves it room on a slow machine. */
const LANDS_WITHIN_MS = 8000;
/** With motion reduced there's no turn: only the land to load. */
const SHOWS_AT_ONCE_WITHIN_MS = 2000;

const GLOBE = CLASS.globe;
/** The owner's mark: the visitor's own, with globe.visitors, is another. */
const MARKER = `${GLOBE} ${CLASS.globeMarker}:not(${CLASS.globeYou})`;

/** The time where the globe's owner is, now and a minute before: the mark
    is told it as the globe lands, so by the time it's read the clock may
    have moved on a minute. */
const timesThere = async (page: Page, { zone }: Globe): Promise<string[]> =>
  page.evaluate((timeZone) => {
    const format = new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    });
    return [Date.now(), Date.now() - 60_000].map((at) => format.format(at));
  }, zone);

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
  test("turns to where the owner is, and marks it", async ({ page, globe: _globe }) => {
    await page.goto("./");
    await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
    await expect(page.locator(MARKER)).toBeVisible();
  });

  test("names the place, then the time there", async ({ page, globe }) => {
    test.skip(!globe.place, "the globe's marker names no place");
    await page.goto("./");
    await expect(page.locator(`${MARKER} ${CLASS.globePlace}`)).toHaveText(globe.place ?? "");
    const time = page.locator(`${MARKER} ${CLASS.globeTime}`);
    await expect(time).not.toBeEmpty();
    expect(await timesThere(page, globe)).toContain(await time.textContent());
  });

  test("with no place named, marks it with the owner's name alone: no place and no time", async ({ page, globe }) => {
    test.skip(Boolean(globe.place), "the globe's marker names its place");
    await page.goto("./");
    await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
    await expect(page.locator(`${MARKER} ${CLASS.globePlace}`)).toHaveCount(0);
    await expect(page.locator(`${MARKER} ${CLASS.globeTime}`)).toHaveCount(0);
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

test.describe("the home screen's globe, with its visitors", () => {
  test("marks the visitor where they are, with their town and their own time", async ({ page, globe }) => {
    test.skip(!globe.visits, "the globe doesn't show its visitors");
    await page.goto("./");
    const you = page.locator(`${GLOBE} ${CLASS.globeYou}`);
    await expect(you).toContainText(VISITS_STAND_IN.you?.town ?? "");
    await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
  });

  test("names the owner over their mark", async ({ page, site, globe: _globe }) => {
    await page.goto("./");
    await expect(page.locator(MARKER).first()).toContainText(site.name);
  });
});

test("the globe turns under a drag, and its marks follow their places", async ({ page, globe: _globe }) => {
  await page.goto("./");
  await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
  const grab = page.locator(`${GLOBE} ${CLASS.globeGrab}`);
  const box = await grab.boundingBox();
  test.skip(!box, "the globe has no room to show");
  const owner = page.locator(MARKER).first();
  const before = await owner.evaluate((marker) => marker.getBoundingClientRect().left);
  const [x, y] = [(box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + 120];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => owner.evaluate((marker) => marker.getBoundingClientRect().left)).toBeGreaterThan(before + 20);
});

test("a visitor in the owner's own town has their words under the owner's, not over them", async ({ page, globe }) => {
  test.skip(!globe.visits, "the globe doesn't show its visitors");
  const [longitude = 0, latitude = 0] = (
    (await page.goto("./").then(() => page.locator(GLOBE).getAttribute(DATA.globeHere))) ?? ""
  )
    .split(" ")
    .map(Number);
  await page.route(`**${new URL(globe.visits ?? "", "https://example.com").pathname}`, (route) =>
    route.fulfill({ json: { you: { latitude, longitude, town: "Next door" }, places: [] } }),
  );
  await page.reload();
  await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
  await expect(page.locator(`${GLOBE} ${CLASS.globeYou}`)).toContainClass(PAGE_CLASSES.globeCrowded);
});

test.describe("the home screen's globe, once it has landed", () => {
  const ownerLeft = (page: Page): Promise<number> =>
    page.locator(MARKER).evaluate((marker) => marker.getBoundingClientRect().left);

  test("turns slowly by itself, east as the Earth does", async ({ page, globe: _globe }) => {
    await page.goto("./");
    await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
    const before = await ownerLeft(page);
    await expect.poll(() => ownerLeft(page)).toBeGreaterThan(before + 4);
  });

  test.describe("with motion reduced", () => {
    test.use({ reducedMotion: "reduce" });

    test("stays where it is", async ({ page, globe: _globe }) => {
      await page.goto("./");
      await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
      const before = await ownerLeft(page);
      await page.waitForTimeout(1500);
      expect(await ownerLeft(page)).toBe(before);
    });
  });
});
