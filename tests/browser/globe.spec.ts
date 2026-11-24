/* The globe behind the home screen's text, on a site with one (the
   config's `globe`): it turns to where its owner is and marks it with the
   place's name, at once with motion reduced, and isn't there at all
   without the script. */
import type { Page } from "@playwright/test";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import { CLASS_SELECTOR as CLASS } from "../../src/contracts/page-selectors.ts";
import { expect, test } from "./fixtures.ts";

/** The turn takes under three seconds; this leaves it room on a slow machine. */
const LANDS_WITHIN_MS = 8000;
/** With motion reduced there's no turn: only the land to load. */
const SHOWS_AT_ONCE_WITHIN_MS = 2000;

const GLOBE = CLASS.globe;
/** The owner's mark: the only one. */
const MARKER = `${GLOBE} ${CLASS.globeMarker}`;

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

  test("names the owner over their mark and the place beside it, and says nothing else: no time", async ({
    page,
    site,
    globe,
  }) => {
    test.skip(!globe.place, "the globe's marker names no place");
    await page.goto("./");
    await expect(page.locator(`${MARKER} ${CLASS.globeName}`)).toHaveText(site.name);
    await expect(page.locator(`${MARKER} ${CLASS.globePlace}`)).toHaveText(globe.place ?? "");
    await expect(page.locator(`${MARKER} > *`)).toHaveCount(2);
  });

  test("with no place named, marks it with the owner's name alone", async ({ page, site, globe }) => {
    test.skip(Boolean(globe.place), "the globe's marker names its place");
    await page.goto("./");
    await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
    await expect(page.locator(`${MARKER} ${CLASS.globePlace}`)).toHaveCount(0);
    await expect(page.locator(MARKER)).toHaveText(site.name);
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

test("the globe marks its owner alone, and nothing of the visitor", async ({ page, globe: _globe }) => {
  await page.goto("./");
  await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
  await expect(page.locator(`${GLOBE} ${CLASS.globeMarker}`)).toHaveCount(1);
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

/** Whether the owner's mark shows whole inside the globe's box, its name too, or doesn't show: never cut off at
    its sides, where the sidebar and the panel are. */
const wholeOrHidden = (page: Page): Promise<boolean> =>
  page.locator(MARKER).evaluate((marker, nameSelector) => {
    if (!(marker instanceof HTMLElement) || marker.hidden) return true;
    const globe = marker.parentElement?.getBoundingClientRect();
    const boxes = [marker, marker.querySelector(nameSelector)].flatMap((part) =>
      part ? [part.getBoundingClientRect()] : [],
    );
    return Boolean(globe) && boxes.every((box) => box.left >= (globe?.left ?? 0) && box.right <= (globe?.right ?? 0));
  }, CLASS.globeName);

/** Where a drag across the globe starts: over its middle, low down, where the globe shows. None when it has no
    room to show. */
async function dragStart(page: Page): Promise<[x: number, y: number] | null> {
  const box = await page.locator(`${GLOBE} ${CLASS.globeGrab}`).boundingBox();
  return box && [box.x + box.width / 2, box.y + box.height - 40];
}

test.describe("the owner's mark, turned to the globe's side", () => {
  test.use({ reducedMotion: "reduce" });

  for (const [side, by] of [
    ["right", 40],
    ["left", -40],
  ] as const) {
    test(`shows whole or not at all, turned to the ${side}`, async ({ page, globe: _globe }) => {
      await page.goto("./");
      await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: SHOWS_AT_ONCE_WITHIN_MS });
      const start = await dragStart(page);
      test.skip(!start, "the globe has no room to show");
      const [x, y] = start ?? [0, 0];
      for (let turn = 0; turn < 40 && (await page.locator(MARKER).isVisible()); turn++) {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + by, y, { steps: 4 });
        await page.mouse.up();
        expect(await wholeOrHidden(page)).toBe(true);
      }
      await expect(page.locator(MARKER)).toBeHidden();
    });
  }
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

    test("draws nothing new: its lights don't twinkle, and no spark runs its line", async ({ page, globe: _globe }) => {
      await page.goto("./");
      await expect(page.locator(GLOBE)).toContainClass(PAGE_CLASSES.landed, { timeout: LANDS_WITHIN_MS });
      const drawing = () =>
        page.locator(`${GLOBE} canvas`).evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
      const before = await drawing();
      // Longer than a spark waits after landing.
      await page.waitForTimeout(3500);
      expect(await drawing()).toBe(before);
    });
  });
});
