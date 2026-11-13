/* The sidebar and the details panel: folding, hiding, resizing and
   reordering, and that each is remembered. */
import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { SIZE, TIMING } from "../../../src/app/constants.ts";
import { DATA } from "../../../src/contracts/page-attributes.ts";
import { attributeOfEach, desktop, revisit, shell, type Check } from "../helpers.ts";
import { CLASS, ID, PANEL_SECTIONS, type Site } from "../site.ts";

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

/** The checks of the sidebar and the details panel, made for the site as
    it was read: its first thread, its groups, its panel's sections. */
export default (site: Site): Check[] => {
  const { A, foldingGroup } = site;
  return [
    {
      name: "folding a sidebar group is remembered, and opening a tab in it unfolds it",
      url: "./",
      skip: foldingGroup ? null : "the sidebar has no groups",
      async test(page) {
        if (!foldingGroup) return;
        const foldButton = page.locator(`[id="${foldingGroup.id}"] ${CLASS.foldButton}`);
        const rows = page.locator(`[id="${foldingGroup.id}"] + ul`);
        await foldButton.click();
        assert.ok(await rows.isHidden(), "folded, the group's rows are hidden");
        assert.equal(await foldButton.getAttribute("aria-expanded"), "false", "the group's button says it's folded");
        await revisit(page, site.url("./"));
        assert.ok(await rows.isHidden(), "the group is still folded on the next visit");
        await page.goto(site.url(`#${foldingGroup.tabs[0]}`));
        await rows.waitFor();
        assert.equal(
          await foldButton.getAttribute("aria-expanded"),
          "true",
          "opening a tab in the group unfolds it, and its button says so",
        );
      },
    },
    {
      name: "the sidebar: arrow keys between rows, hidden and back, resized by keyboard and remembered",
      url: `#${A.id}`,
      async test(page) {
        await checkArrowDownGoesToTheNextRow(page);
        await checkSidebarHidesAndComesBack(page, A.id);

        const edge = page.locator(CLASS.resizer);
        const defaultWidth = await sidebarWidth(page);
        const twoStepsWider = defaultWidth + 2 * SIZE.sidebarStep;
        await edge.focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        assert.equal(await sidebarWidth(page), twoStepsWider, "ArrowRight twice makes the sidebar two steps wider");
        await revisit(page, site.url(`#${A.id}`));
        assert.equal(await sidebarWidth(page), twoStepsWider, "the sidebar is that wide on the next visit");
        await edge.dblclick();
        assert.equal(await sidebarWidth(page), defaultWidth, "a double-click on its edge puts the default width back");
      },
    },
    {
      name: "the sidebar's edge: dragged, its width is remembered; only clicked, it isn't",
      url: `#${A.id}`,
      async test(page) {
        const edge = page.locator(CLASS.resizer);
        await edge.click();
        await revisit(page, site.url(`#${A.id}`));
        // A width that's been set is on the shell, as its style.
        assert.equal(await shell(page).getAttribute("style"), null, "a click on the edge leaves the default width");

        const widthBefore = await sidebarWidth(page);
        await pressAndMove(page, edge, "the sidebar's edge", { dx: EDGE_DRAG_PX, moves: EDGE_DRAG_MOVES });
        await page.mouse.up();
        assert.equal(
          await sidebarWidth(page),
          widthBefore + EDGE_DRAG_PX,
          "the sidebar is wider by as far as it was dragged",
        );
        await revisit(page, site.url(`#${A.id}`));
        assert.equal(
          await sidebarWidth(page),
          widthBefore + EDGE_DRAG_PX,
          "the sidebar is that wide on the next visit",
        );
      },
    },
    {
      name: "the panel's sections drag by their grips, twice in a row too",
      url: "./",
      skip: site.panel.length > 1 ? null : "the panel has one section",
      // Nothing slides, so a grip is where it was measured when it's pressed.
      device: { ...desktop, reducedMotion: "reduce" },
      async test(page) {
        const [first = "", second = "", ...rest] = site.panel;
        const firstsGrip = page.locator(`${PANEL_SECTIONS}[aria-labelledby="${first}"] ${CLASS.grip}`);
        const pastTheNext = await dragDistancePastTheSecondSection(page);
        const dragFirstSection = (dy: number) =>
          pressAndMove(page, firstsGrip, "the section's grip", { dy, moves: SECTION_DRAG_MOVES });

        await dragFirstSection(pastTheNext);
        await page.mouse.up();
        assert.deepEqual(
          await panelOrder(page),
          [second, first, ...rest],
          "dragged past the second section, the first is under it",
        );
        // Back up at once, before the drop has settled. When it would have,
        // the section is being dragged again: it stays lifted.
        await dragFirstSection(-pastTheNext);
        await page.waitForTimeout(TIMING.settle + SETTLE_MARGIN_MS);
        assert.equal(
          await page.locator(`${ID.panel} ${CLASS.dragging}`).count(),
          1,
          "the section is still lifted while the mouse holds it",
        );
        await page.mouse.up();
        assert.deepEqual(await panelOrder(page), site.panel, "dragged back up, the sections are in their first order");
      },
    },
    {
      name: "the panel: hidden and back, a section folded and moved, remembered",
      url: "./",
      skip: site.panel.length > 1 ? null : "the panel has one section",
      async test(page) {
        const panel = page.locator(ID.panel);
        const toggle = page.locator(`${ID.home} [${DATA.panelToggle}]`);
        await toggle.click();
        assert.ok(await panel.isHidden(), "the panel's button hides it");
        assert.equal(await toggle.getAttribute("aria-expanded"), "false", "the panel's button says it's hidden");
        await toggle.click();
        assert.ok(await panel.isVisible(), "the panel's button brings it back");

        const [first = "", second = "", ...rest] = site.panel;
        const firstMovedDown = [second, first, ...rest];
        await page.locator(PANEL_SECTIONS).first().locator(CLASS.grip).focus();
        await page.keyboard.press("ArrowDown");
        assert.deepEqual(await panelOrder(page), firstMovedDown, "ArrowDown on its grip moves the first section down");
        const foldButton = page.locator(`[id="${second}"] ${CLASS.foldButton}`);
        await foldButton.click();
        assert.equal(await foldButton.getAttribute("aria-expanded"), "false", "the section's button says it's folded");

        await revisit(page, site.url("./"));
        assert.deepEqual(await panelOrder(page), firstMovedDown, "the sections are in that order on the next visit");
        assert.equal(
          await foldButton.getAttribute("aria-expanded"),
          "false",
          "the section is still folded on the next visit",
        );
      },
    },
  ];
};

// ---- The sidebar -------------------------------------------------------------------------

/** From the sidebar's first row, ArrowDown takes the focus to its second. */
async function checkArrowDownGoesToTheNextRow(page: Page): Promise<void> {
  const rows = page.locator(`${ID.sidebar} ${CLASS.nav} a`);
  await rows.first().focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.locator(":focus").getAttribute("href"),
    await rows.nth(1).getAttribute("href"),
    "ArrowDown takes the focus from the sidebar's first row to its second",
  );
}

/** The sidebar's own button hides it, leaving the focus on the open tab's
    menu button; that button brings it back, and the focus goes back too. */
async function checkSidebarHidesAndComesBack(page: Page, openTabId: string): Promise<void> {
  const sidebar = page.locator(ID.sidebar);
  const menuButton = `#${openTabId} ${CLASS.menuButton}`;
  await page.locator(`[${DATA.sideToggle}]`).click();
  assert.ok(await sidebar.isHidden(), "the sidebar's button hides it");
  assert.equal(await page.locator(`${menuButton}:focus`).count(), 1, "the focus is on the tab's menu button");
  await page.locator(menuButton).click();
  assert.ok(await sidebar.isVisible(), "the tab's menu button brings the sidebar back");
  assert.equal(
    await page.locator(`[${DATA.sideToggle}]:focus`).count(),
    1,
    "the focus is back on the sidebar's button",
  );
}

/** How wide the sidebar is, in pixels, as its edge (a separator) says. */
const sidebarWidth = async (page: Page): Promise<number> =>
  Number(await page.locator(CLASS.resizer).getAttribute("aria-valuenow"));

/** Presses the mouse on the middle of `handle` and moves it `dx` pixels
    across and `dy` down, in `moves` moves as a hand would, without letting
    go: page.mouse.up() does that. `called` names the handle, should it not
    be on screen. */
async function pressAndMove(
  page: Page,
  handle: Locator,
  called: string,
  { dx = 0, dy = 0, moves }: { dx?: number; dy?: number; moves: number },
): Promise<void> {
  const box = await handle.boundingBox();
  assert.ok(box, `${called} is on screen`);
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: moves });
}

// ---- The details panel -------------------------------------------------------------------

/** The panel's sections in the order they're in now: the id of each one's
    heading, as site.panel has them. */
const panelOrder = (page: Page): Promise<Array<string | null>> =>
  attributeOfEach(page.locator(PANEL_SECTIONS), "aria-labelledby");

/** How far down the first section has to be dragged to change places with
    the second, in pixels: until its middle is just past the second's,
    whatever their heights. (The same distance back up undoes it.) */
async function dragDistancePastTheSecondSection(page: Page): Promise<number> {
  const sections = page.locator(PANEL_SECTIONS);
  const [first, second] = [await sections.nth(0).boundingBox(), await sections.nth(1).boundingBox()];
  assert.ok(first && second, "the first two sections are on screen");
  const middleOf = (box: { y: number; height: number }) => box.y + box.height / 2;
  return middleOf(second) - middleOf(first) + PAST_THE_MIDDLE_PX;
}
