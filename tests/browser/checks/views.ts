/* The site seen other ways: in its other languages, on a phone, without
   JavaScript and printed. */
import assert from "node:assert/strict";
import {
  desktop,
  eventually,
  iPhone,
  OPEN_CHAT,
  pickFirstTab,
  settled,
  settledTitle,
  skip,
  squash,
  type Check,
} from "../helpers.ts";
import { DATA, PAGE_CLASSES, SEPARATOR } from "../../../src/shared/page-data.ts";
import { CLASS, ID, type Site } from "../site.ts";

// Runs inside the page, where there's a DOM (Node's own types have none).
declare function getComputedStyle(el: unknown): { color: string; visibility: string };

/** An element, as far as measuring it goes. */
type Measured = {
  textContent: string | null;
  getBoundingClientRect(): { left: number; right: number };
  querySelectorAll(selector: string): Iterable<Measured>;
};

/** The words of a figure's parts (its caption, labels, values and steps)
    that reach past its frame, for each figure. */
const outsideTheirFigure = (figures: Measured[]): string[] =>
  figures.flatMap((figure) => {
    const frame = figure.getBoundingClientRect();
    return [...figure.querySelectorAll("figcaption, dt, dd, text, li")]
      .filter((part) => {
        const box = part.getBoundingClientRect();
        return box.left < frame.left - 0.5 || box.right > frame.right + 0.5;
      })
      .map((part) => part.textContent ?? "");
  });

export default (site: Site): Check[] => {
  const { A, C } = site;
  const last = site.threads.at(-1) ?? A;
  return [
    {
      name: "a phone starts in a new chat that says who this is",
      url: "./",
      device: iPhone,
      async test(page) {
        const chat = page.locator(`${CLASS.tab}[${DATA.chat}] ${CLASS.chatHello}`);
        await chat.locator(CLASS.chatName).filter({ hasText: site.name }).waitFor();
        if (site.tagline) assert.equal(await chat.locator(CLASS.intro).textContent(), site.tagline);
        await page.locator(`${ID.followUp}:not([hidden])`).waitFor();
      },
    },
    {
      name: "on a phone, a reply is read from its start: its question stays in view, not scrolled past",
      url: "./",
      device: iPhone,
      async test(page) {
        const chat = page.locator(`.${PAGE_CLASSES.tab}[${DATA.chat}]`);
        const thread = chat.locator(`.${PAGE_CLASSES.thread}`);
        await page.locator(`${ID.followUp}:not([hidden])`).waitFor();
        // Into an empty thread, then under what's already in it.
        for (const [nth, when] of ["in a new chat", "under an earlier reply"].entries()) {
          if (nth) await chat.locator(CLASS.composer).click();
          await pickFirstTab(page);
          const asked = thread.locator(`> .${PAGE_CLASSES.question}`).nth(nth);
          await thread.locator(`> .${PAGE_CLASSES.answer}`).nth(nth).waitFor();
          const frame = await chat.locator(CLASS.scroll).boundingBox();
          assert.ok(frame, "the thread is on screen");
          // How far the question is below the top of what's shown of the thread.
          const top = await settled(page, async () => Math.round(((await asked.boundingBox())?.y ?? NaN) - frame.y));
          assert.ok(top >= 0 && top < frame.height, `${when}, the question is ${top}px from the top of the thread`);
        }
      },
    },
    {
      name: "on a phone, a figure and everything written in it fit the column",
      url: "./",
      device: iPhone,
      skip: site.figureTabs.length ? null : "no thread has a figure",
      async test(page) {
        const width = page.viewportSize()?.width ?? 0;
        for (const id of site.figureTabs) {
          await page.goto(site.url(`#${id}`));
          const figures = page.locator(`#${id} .${PAGE_CLASSES.figure}`);
          await figures.first().waitFor();
          assert.deepEqual(await figures.evaluateAll(outsideTheirFigure), [], `in #${id}`);
          for (const figure of await figures.all()) {
            const box = await figure.boundingBox();
            assert.ok(box && box.x >= 0 && box.x + box.width <= width, `a figure in #${id} is wider than the screen`);
          }
        }
      },
    },
    ...site.languages.map(({ href, lang }): Check => ({
      name: `the ${lang} page, on the same tab`,
      url: `${href}#${A.id}`,
      async test(page) {
        assert.equal(await page.locator("html").getAttribute("lang"), lang);
        const title = squash(await page.locator(`#${A.id} ${CLASS.titleText}`).textContent());
        await page.locator(`#${A.id} ${CLASS.thread} > ${CLASS.question}`).first().waitFor();
        const windowTitle = await settledTitle(page, (text) => text.startsWith(`${title}${SEPARATOR}`));
        assert.ok(windowTitle.startsWith(`${title}${SEPARATOR}`), "the tab's name in the window title");
      },
    })),
    {
      name: "without JavaScript, a tab still opens",
      url: `#${last.id}`,
      device: { ...desktop, javaScriptEnabled: false },
      async test(page) {
        assert.ok(await page.locator(`#${last.id} ${CLASS.thread}`).isVisible());
        assert.ok(!(await page.locator(ID.top).isVisible()));
        // Its link would close the tab, so there's no skip link.
        await page.keyboard.press("Tab");
        assert.ok(await page.locator(CLASS.skip).isHidden());
      },
    },
    {
      name: "on a phone, Back to where the visit started is a new chat again, not the home screen",
      url: "./",
      device: iPhone,
      async test(page) {
        const card = page.locator(`${ID.followUp}:not([hidden])`);
        const chat = page.locator(OPEN_CHAT);
        await card.waitFor();
        await chat.locator(CLASS.menu).click();
        await page.locator(`${ID.tabs} a[href="#${A.id}"]`).first().click();
        await page.locator(`#${A.id}:target`).waitFor();
        // Once the page has caught up (the drawer closes on the hashchange).
        await page.locator(`${ID.tabs}${CLASS.drawerOpen}`).waitFor({ state: "detached" });
        await page.goBack();
        await chat.waitFor();
        await card.waitFor();
        assert.ok(await page.locator(ID.top).isHidden(), "not the home screen");
      },
    },
    {
      name: "printed: who this is first, dark text, no 'Something else'",
      url: "./",
      async test(page) {
        await page.locator(ID.hello).waitFor();
        await page.emulateMedia({ media: "print" });
        assert.ok(await page.locator(CLASS.printHead).isVisible());
        assert.ok(!(await page.locator(ID.asked).isVisible()));
        // A status line's file name if there is one: it's light on the screen.
        const text = page
          .locator(
            site.statusLine
              ? `${CLASS.tab} ${CLASS.status} summary b`
              : `${CLASS.tab} ${CLASS.thread} ${CLASS.answer} p`,
          )
          .first();
        const color = await text.evaluate((el: unknown) => getComputedStyle(el).color);
        const [r = 255, g = 255, b = 255] = (color.match(/\d+/g) ?? []).map(Number);
        assert.ok(r + g + b < 200, `printed in ${color}`);
      },
    },
    {
      name: "on a phone, Share shows only its icon, and keeps its name",
      url: `#${A.id}`,
      device: iPhone,
      async test(page) {
        const share = page.locator(`#${A.id} [${DATA.copyLink}]:has(${CLASS.label})`);
        const label = share.locator(`.${PAGE_CLASSES.label}`);
        const name = squash(await label.textContent());
        assert.ok(name, "its words are in the page");
        await page.getByRole("button", { name, exact: true }).and(share).waitFor({ timeout: 2000 });
        const box = await label.boundingBox();
        assert.ok(box && box.width <= 1 && box.height <= 1, "and take no room");
      },
    },
    {
      name: "on a phone the menu button opens the drawer, and Escape, its close button or a row closes it",
      url: `#${A.id}`,
      device: iPhone,
      async test(page) {
        const drawer = page.locator(`${ID.tabs}${CLASS.drawerOpen}`);
        const button = page.locator(`#${A.id} ${CLASS.menu}`);
        await button.click();
        await drawer.waitFor();
        assert.equal(await page.locator(`${ID.tabs} :focus`).count(), 1, "focus in the drawer");
        await page.keyboard.press("Escape");
        assert.equal(await drawer.count(), 0);
        await page.locator(`#${A.id} ${CLASS.menu}:focus`).waitFor();
        await button.click();
        await page.locator(`${ID.tabs} ${CLASS.drawerClose}`).click();
        assert.equal(await drawer.count(), 0);
        await page.locator(`#${A.id} ${CLASS.menu}:focus`).waitFor();
        if (!C) return skip("a row closing the phone drawer", "the sidebar has one thread");
        await page.locator(`#${A.id} ${CLASS.menu}`).click();
        await page.locator(`${ID.tabs} a[href="#${C.id}"]`).first().click();
        await page.locator(`#${C.id}:target`).waitFor();
        // Once the tab's open (on the hashchange after it).
        await drawer.waitFor({ state: "detached", timeout: 2000 });
      },
    },
    {
      name: "on a phone the drawer slides out before it's hidden",
      url: `#${A.id}`,
      device: iPhone,
      async test(page) {
        const side = page.locator(ID.tabs);
        const visibility = () => side.evaluate((el: unknown) => getComputedStyle(el).visibility);
        await page.locator(`#${A.id} ${CLASS.menu}`).click();
        await page.locator(`${ID.tabs}${CLASS.drawerOpen}`).waitFor();
        // Motion at a tenth of its speed, to see it on its way.
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Animation.enable");
        await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });
        await page.keyboard.press("Escape");
        assert.equal(await visibility(), "visible", "still showing as it slides");
        await eventually(async () => assert.equal(await visibility(), "hidden"));
      },
    },
  ];
};
