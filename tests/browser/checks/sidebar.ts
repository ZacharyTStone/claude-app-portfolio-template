/* The sidebar and the details panel: folding, hiding, resizing and
   reordering, and that each is remembered. */
import assert from "node:assert/strict";
import { desktop, revisit, type Attributed, type Check } from "../helpers.ts";
import { DATA } from "../../../src/shared/page-data.ts";
import { TIMING } from "../../../src/app/constants.ts";
import { CLASS, ID, type Site } from "../site.ts";

export default (site: Site): Check[] => {
  const { A, foldingGroup } = site;
  return [
    {
      name: "folding a sidebar group is remembered, and opening a tab in it unfolds it",
      url: "./",
      skip: foldingGroup ? null : "the sidebar has no groups",
      async test(page) {
        const { id = "", tabs = [] } = foldingGroup ?? {};
        const button = page.locator(`[id="${id}"] ${CLASS.foldButton}`);
        const list = page.locator(`[id="${id}"] + ul`);
        await button.click();
        assert.ok(await list.isHidden());
        assert.equal(await button.getAttribute("aria-expanded"), "false");
        await revisit(page, site.url("./"));
        assert.ok(await list.isHidden(), "still folded on the next visit");
        await page.goto(site.url(`#${tabs[0]}`));
        await list.waitFor();
        assert.equal(await button.getAttribute("aria-expanded"), "true");
      },
    },
    {
      name: "the sidebar: arrow keys between rows, hidden and back, resized by keyboard and remembered",
      url: `#${A.id}`,
      async test(page) {
        const rows = page.locator(`${ID.tabs} ${CLASS.nav} a`);
        await rows.first().focus();
        await page.keyboard.press("ArrowDown");
        assert.equal(await page.locator(":focus").getAttribute("href"), await rows.nth(1).getAttribute("href"));
        await page.locator(`[${DATA.sideToggle}]`).click();
        assert.ok(await page.locator(ID.tabs).isHidden());
        assert.equal(await page.locator(`#${A.id} ${CLASS.menu}:focus`).count(), 1);
        await page.locator(`#${A.id} ${CLASS.menu}`).click();
        assert.ok(await page.locator(ID.tabs).isVisible());
        assert.equal(await page.locator(`[${DATA.sideToggle}]:focus`).count(), 1);
        const edge = page.locator(CLASS.resizer);
        const width = async () => Number(await edge.getAttribute("aria-valuenow"));
        const before = await width();
        await edge.focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        assert.equal(await width(), before + 32);
        await revisit(page, site.url(`#${A.id}`));
        assert.equal(await width(), before + 32, "the width, on the next visit");
        await edge.dblclick();
        assert.equal(await width(), before, "double-clicked: back to the default");
      },
    },
    {
      name: "the sidebar's edge: dragged, its width is remembered; only clicked, it isn't",
      url: `#${A.id}`,
      async test(page) {
        const edge = page.locator(CLASS.resizer);
        const width = async () => Number(await edge.getAttribute("aria-valuenow"));
        const pinned = () => page.locator(ID.tabs).locator("..").getAttribute("style");
        await edge.click();
        await revisit(page, site.url(`#${A.id}`));
        assert.equal(await pinned(), null, "a click leaves the default width");
        const before = await width();
        const box = await edge.boundingBox();
        assert.ok(box, "the edge is on screen");
        const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 40, y, { steps: 4 });
        await page.mouse.up();
        assert.equal(await width(), before + 40);
        await revisit(page, site.url(`#${A.id}`));
        assert.equal(await width(), before + 40, "the width, on the next visit");
      },
    },
    {
      name: "the panel's sections drag by their grips, twice in a row too",
      url: "./",
      skip: site.panel.length > 1 ? null : "the panel has one section",
      // Nothing slides, so a grip is where it was measured when it's pressed.
      device: { ...desktop, reducedMotion: "reduce" },
      async test(page) {
        const sections = page.locator(`${ID.details} > section`);
        const order = () =>
          sections.evaluateAll((all: Attributed[]) => all.map((s) => s.getAttribute("aria-labelledby")));
        const [first = "", second = "", ...rest] = site.panel;
        // Drags the section `id` by its grip, `dy` down.
        const drag = async (id: string, dy: number) => {
          const section = page.locator(`${ID.details} > section[aria-labelledby="${id}"]`);
          const box = await section.locator(CLASS.grip).boundingBox();
          assert.ok(box, "its grip is on screen");
          const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x, y + dy, { steps: 8 });
        };
        // Just far enough that its middle passes the middle of the one below
        // (and then, back up, of the one above), whatever their heights.
        const [top, next] = [await sections.nth(0).boundingBox(), await sections.nth(1).boundingBox()];
        assert.ok(top && next, "the first two sections are on screen");
        const past = next.y + next.height / 2 - (top.y + top.height / 2) + 4;
        await drag(first, past);
        await page.mouse.up();
        assert.deepEqual(await order(), [second, first, ...rest]);
        // At once, before it has settled: it stays lifted while it's dragged.
        await drag(first, -past);
        await page.waitForTimeout(TIMING.settle + 100);
        assert.equal(await page.locator(`${ID.details} ${CLASS.dragging}`).count(), 1, "still lifted");
        await page.mouse.up();
        assert.deepEqual(await order(), site.panel);
      },
    },
    {
      name: "the panel: hidden and back, a section folded and moved, remembered",
      url: "./",
      skip: site.panel.length > 1 ? null : "the panel has one section",
      async test(page) {
        const panel = page.locator(ID.details);
        const toggle = page.locator(`${ID.top} [${DATA.panelToggle}]`);
        const sections = panel.locator(":scope > section");
        const order = () =>
          sections.evaluateAll((all: Attributed[]) => all.map((s) => s.getAttribute("aria-labelledby")));
        await toggle.click();
        assert.ok(await panel.isHidden());
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        await toggle.click();
        assert.ok(await panel.isVisible());
        const [first = "", second = "", ...rest] = site.panel;
        await sections.first().locator(CLASS.grip).focus();
        await page.keyboard.press("ArrowDown");
        assert.deepEqual(await order(), [second, first, ...rest]);
        const heading = page.locator(`[id="${second}"] ${CLASS.foldButton}`);
        await heading.click();
        assert.equal(await heading.getAttribute("aria-expanded"), "false");
        await revisit(page, site.url("./"));
        assert.deepEqual(await order(), [second, first, ...rest], "the order, on the next visit");
        assert.equal(await heading.getAttribute("aria-expanded"), "false", "and the fold");
      },
    },
  ];
};
