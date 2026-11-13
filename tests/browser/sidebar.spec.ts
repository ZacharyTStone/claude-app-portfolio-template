/* The sidebar and the details panel: folding, hiding, resizing and
   reordering, and that each is remembered. */
import type { Locator, Page } from "@playwright/test";
import { TIMING } from "../../src/app/constants.ts";
import { SIDEBAR_WIDTH } from "../../src/app/sidebar-width.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
} from "../../src/contracts/page-selectors.ts";
import { expect, test } from "./fixtures.ts";
import { PANEL_SECTIONS } from "./parts.ts";
import { revisit } from "./visitor.ts";

/** How far the sidebar's edge is dragged, in pixels, and in how many moves
    of the mouse. */
const EDGE_DRAG_PX = 40;
const EDGE_DRAG_MOVES = 4;

/** In how many moves of the mouse a panel section is dragged, and how far
    past the middle of the section next to it, in pixels. */
const SECTION_DRAG_MOVES = 8;
const PAST_THE_MIDDLE_PX = 4;

/** How long the check gives a dropped section to settle, past the time the
    script takes over it (TIMING.settle), in milliseconds. */
const SETTLE_MARGIN_MS = 100;

test.describe("a sidebar group, folded", () => {
  test.beforeEach(async ({ page, foldingGroup }) => {
    await page.goto("./");
    await foldButtonOf(page, foldingGroup.id).click();
  });

  test("hides its rows, and its button says it's folded", async ({ page, foldingGroup }) => {
    await expect(rowsUnder(page, foldingGroup.id)).toBeHidden();
    await expect(foldButtonOf(page, foldingGroup.id)).toHaveAttribute("aria-expanded", "false");
  });

  test("is still folded on the next visit", async ({ page, foldingGroup }) => {
    await revisit(page, "./");
    await expect(rowsUnder(page, foldingGroup.id)).toBeHidden();
  });

  test("unfolds when a tab in it opens, and its button says so", async ({ page, foldingGroup }) => {
    await page.goto(`#${foldingGroup.tabs[0]}`);
    await expect(rowsUnder(page, foldingGroup.id)).toBeVisible();
    await expect(foldButtonOf(page, foldingGroup.id)).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("the sidebar, beside an open tab", () => {
  test.beforeEach(async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
  });

  test("ArrowDown takes the focus from its first row to its second", async ({ page }) => {
    const rows = page.locator(`${ID.sidebar} ${CLASS.nav} a`);
    const secondRowOpens = (await rows.nth(1).getAttribute("href")) ?? "";
    await rows.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(":focus")).toHaveAttribute("href", secondRowOpens);
  });

  test("its own button hides it, leaving the focus on the tab's menu button", async ({ page, site }) => {
    await page.locator(ATTRIBUTE.sideToggle).click();
    await expect(page.locator(ID.sidebar)).toBeHidden();
    await expect(page.locator(`#${site.firstThread.id} ${CLASS.menuButton}`)).toBeFocused();
  });

  test("the tab's menu button brings it back, and the focus goes back to its own button", async ({ page, site }) => {
    await page.locator(ATTRIBUTE.sideToggle).click();
    await page.locator(`#${site.firstThread.id} ${CLASS.menuButton}`).click();
    await expect(page.locator(ID.sidebar)).toBeVisible();
    await expect(page.locator(ATTRIBUTE.sideToggle)).toBeFocused();
  });

  test("a click on its edge, with no drag, leaves the default width", async ({ page, site }) => {
    await page.locator(CLASS.resizer).click();
    await revisit(page, `#${site.firstThread.id}`);
    // A width that's been set is on the shell, as its style.
    await expect(page.locator(CLASS.shell)).not.toHaveAttribute("style");
  });
});

test.describe("the sidebar's edge, moved two steps by ArrowRight", () => {
  let defaultWidth: number;

  test.beforeEach(async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
    defaultWidth = await sidebarWidth(page);
    await page.locator(CLASS.resizer).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
  });

  test("makes the sidebar two steps wider", async ({ page }) => {
    await expectSidebarWidth(page, defaultWidth + 2 * SIDEBAR_WIDTH.arrowKeyStep);
  });

  test("leaves it that wide on the next visit", async ({ page, site }) => {
    await revisit(page, `#${site.firstThread.id}`);
    await expectSidebarWidth(page, defaultWidth + 2 * SIDEBAR_WIDTH.arrowKeyStep);
  });

  test("is undone by a double-click on the edge, which puts the default width back", async ({ page }) => {
    await page.locator(CLASS.resizer).dblclick();
    await expectSidebarWidth(page, defaultWidth);
  });
});

test.describe("the sidebar's edge, dragged", () => {
  let widthBefore: number;

  test.beforeEach(async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
    widthBefore = await sidebarWidth(page);
    await pressAndMove(page, page.locator(CLASS.resizer), { dx: EDGE_DRAG_PX, moves: EDGE_DRAG_MOVES });
    await page.mouse.up();
  });

  test("makes the sidebar wider by as far as it was dragged", async ({ page }) => {
    await expectSidebarWidth(page, widthBefore + EDGE_DRAG_PX);
  });

  test("leaves it that wide on the next visit", async ({ page, site }) => {
    await revisit(page, `#${site.firstThread.id}`);
    await expectSidebarWidth(page, widthBefore + EDGE_DRAG_PX);
  });
});

test.describe("the details panel", () => {
  test.skip(({ site }) => site.panel.length < 2, "the panel has one section");

  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("its button hides it and says so, and brings it back", async ({ page }) => {
    const toggle = page.locator(`${ID.home} ${ATTRIBUTE.panelToggle}`);
    await toggle.click();
    await expect(page.locator(ID.panel)).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(page.locator(ID.panel)).toBeVisible();
  });

  test.describe("with its first section moved down by ArrowDown on its grip", () => {
    test.beforeEach(async ({ page }) => {
      await page.locator(PANEL_SECTIONS).first().locator(CLASS.grip).focus();
      await page.keyboard.press("ArrowDown");
    });

    test("has that section under the second", async ({ page, site }) => {
      await expect.poll(() => panelOrder(page)).toEqual(withTheFirstMovedDown(site.panel));
    });

    test("has its sections in that order on the next visit", async ({ page, site }) => {
      await revisit(page, "./");
      await expect.poll(() => panelOrder(page)).toEqual(withTheFirstMovedDown(site.panel));
    });
  });

  test.describe("with a section folded", () => {
    test.beforeEach(async ({ page, site }) => {
      await foldButtonOf(page, site.panel[1] ?? "").click();
    });

    test("has that section's button say it's folded", async ({ page, site }) => {
      await expect(foldButtonOf(page, site.panel[1] ?? "")).toHaveAttribute("aria-expanded", "false");
    });

    test("has it still folded on the next visit", async ({ page, site }) => {
      await revisit(page, "./");
      await expect(foldButtonOf(page, site.panel[1] ?? "")).toHaveAttribute("aria-expanded", "false");
    });
  });

  test.describe("with its first section dragged by its grip", () => {
    // Nothing slides, so a grip is where it was measured when it's pressed.
    test.use({ reducedMotion: "reduce" });

    test("past the second and dropped, has that section under the second", async ({ page, site }) => {
      await dragSection(page, firstOf(site.panel), await dragDistancePastTheSecondSection(page));
      await page.mouse.up();
      await expect.poll(() => panelOrder(page)).toEqual(withTheFirstMovedDown(site.panel));
    });

    test("dropped, then dragged back before the drop has settled, keeps it lifted, and then has the first order again", async ({
      page,
      site,
    }) => {
      const pastTheSecond = await dragDistancePastTheSecondSection(page);
      await dragSection(page, firstOf(site.panel), pastTheSecond);
      await page.mouse.up();
      await dragSection(page, firstOf(site.panel), -pastTheSecond);
      // Past when the drop would have settled: the section is being dragged again, and stays lifted.
      await page.waitForTimeout(TIMING.settle + SETTLE_MARGIN_MS);
      await expect(
        page.locator(`${ID.panel} ${CLASS.dragging}`),
        "the section is still lifted while the mouse holds it",
      ).toHaveCount(1);
      await page.mouse.up();
      await expect.poll(() => panelOrder(page)).toEqual(site.panel);
    });
  });
});

const foldButtonOf = (page: Page, headingId: string): Locator =>
  page.locator(`[id="${headingId}"] ${CLASS.foldButton}`);

const rowsUnder = (page: Page, groupHeadingId: string): Locator => page.locator(`[id="${groupHeadingId}"] + ul`);

/** How wide the sidebar is, in pixels, as its edge (a separator) says. */
const sidebarWidth = async (page: Page): Promise<number> =>
  Number(await page.locator(CLASS.resizer).getAttribute("aria-valuenow"));

const expectSidebarWidth = (page: Page, pixels: number): Promise<void> =>
  expect(page.locator(CLASS.resizer)).toHaveAttribute("aria-valuenow", String(pixels));

/** Presses the mouse on the middle of `handle` and moves it `dx` pixels
    across and `dy` down, in `moves` moves as a hand would, without letting
    go: page.mouse.up() does that. */
async function pressAndMove(
  page: Page,
  handle: Locator,
  { dx = 0, dy = 0, moves }: { dx?: number; dy?: number; moves: number },
): Promise<void> {
  const box = await handle.boundingBox();
  if (!box) throw new Error(`${String(handle)} isn't on screen to drag`);
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: moves });
}

/** The panel's sections in the order they're in now: the id of each one's
    heading, as site.panel has them. */
const panelOrder = (page: Page): Promise<Array<string | null>> =>
  page
    .locator(PANEL_SECTIONS)
    .evaluateAll((sections) => sections.map((section) => section.getAttribute("aria-labelledby")));

const withTheFirstMovedDown = ([first = "", second = "", ...rest]: string[]): string[] => [second, first, ...rest];

const firstOf = (panel: string[]): string => panel[0] ?? "";

/** Presses the grip of the section under the heading `headingId`, and
    moves it `dy` pixels down without letting go. */
const dragSection = (page: Page, headingId: string, dy: number): Promise<void> =>
  pressAndMove(page, page.locator(`${PANEL_SECTIONS}[aria-labelledby="${headingId}"] ${CLASS.grip}`), {
    dy,
    moves: SECTION_DRAG_MOVES,
  });

/** How far down the first section has to be dragged to change places with
    the second, in pixels: until its middle is just past the second's,
    whatever their heights. (The same distance back up undoes it.) */
async function dragDistancePastTheSecondSection(page: Page): Promise<number> {
  const sections = page.locator(PANEL_SECTIONS);
  const [first, second] = [await sections.nth(0).boundingBox(), await sections.nth(1).boundingBox()];
  if (!first || !second) throw new Error("The panel's first two sections aren't on screen to drag");
  const middleOf = (box: { y: number; height: number }) => box.y + box.height / 2;
  return middleOf(second) - middleOf(first) + PAST_THE_MIDDLE_PX;
}
