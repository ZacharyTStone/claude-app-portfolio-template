/* The viewer: a link the config's `viewer` lists opens beside the
   conversation, in a frame. The site the frame's page comes from is stood
   in for here: the checks never use the network. */
import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { desktop, eventually, iPhone, type Check } from "../helpers.ts";
import { DATA } from "../../../src/shared/page-data.ts";
import { CLASS, ID, type Site } from "../site.ts";

const FRAMED_TEXT = "A document, stood in for.";
const FRAMED_PAGE = `<!doctype html><title>A document</title><p>${FRAMED_TEXT}</p>`;

/** Stands in for the sites of `addresses`, in this tab and any it opens. */
async function sitesReturnAPage(page: Page, addresses: string[]): Promise<void> {
  for (const origin of new Set(addresses.map((address) => new URL(address).origin))) {
    await page
      .context()
      .route(`${origin}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: FRAMED_PAGE }));
  }
}

/** An element, as far as knowing whether it has the focus goes. */
type Focusable = { ownerDocument: { activeElement: unknown } };

/** A link, as far as clicking it by hand goes. */
type Clickable = {
  dispatchEvent(event: unknown): boolean;
  ownerDocument: {
    defaultView: {
      MouseEvent: new (type: string, init: Record<string, boolean>) => unknown;
      addEventListener(
        type: string,
        listener: (event: { defaultPrevented: boolean; preventDefault(): void }) => void,
        options: { once: boolean },
      ): void;
    } | null;
  };
};

/** Clicks a link with these keys held, and says whether the page took the
    click for itself (it stopped the browser following the link). Either
    way the link isn't followed: the checks open no other site. */
const clickTaken = (link: Locator, keys: Record<string, boolean>): Promise<boolean> =>
  link.evaluate((el: Clickable, held) => {
    const view = el.ownerDocument.defaultView;
    if (!view) throw new Error("The link's page has no window");
    let taken = false;
    // The window hears the click after everything in the page has.
    view.addEventListener(
      "click",
      (event) => {
        taken = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    el.dispatchEvent(new view.MouseEvent("click", { bubbles: true, cancelable: true, ...held }));
    return taken;
  }, keys);

export default (site: Site): Check[] => {
  const { viewer } = site;
  const skip = viewer ? null : "the site has no viewer";
  const tab = viewer?.tab ?? "";
  const href = viewer?.href ?? "";
  const shown = viewer?.shown ?? "";
  /** The link, in its tab, and the viewer once it's open. */
  const link = (page: Page) => page.locator(`#${tab} a[${DATA.view}="${shown}"]`).first();
  const open = (page: Page) => page.locator(`${CLASS.viewer}:not([hidden])`);
  async function openViewer(page: Page) {
    await sitesReturnAPage(page, [href, shown]);
    await link(page).click();
    await open(page).waitFor();
  }
  return [
    {
      name: "a link the viewer lists opens beside the conversation, in a frame from its site and nowhere else",
      url: `#${tab}`,
      skip,
      async test(page) {
        await openViewer(page);
        const frame = open(page).locator("iframe");
        assert.equal(await frame.getAttribute("src"), shown, "the frame shows the address the config gives");
        assert.equal(await open(page).locator(CLASS.viewerTitle).textContent(), viewer?.title);
        // The page it shows loaded: the security policy let that site in.
        await page.frameLocator(`${CLASS.viewer} iframe`).getByText(FRAMED_TEXT).waitFor();
        await eventually(async () => {
          assert.equal(await page.locator(`${CLASS.viewerFrame}${CLASS.viewerLoading}`).count(), 0, "it has loaded");
        });
        // The framed page can't take the visitor anywhere, and isn't told where they came from.
        assert.doesNotMatch((await frame.getAttribute("sandbox")) ?? "", /allow-top-navigation/);
        assert.equal(await frame.getAttribute("referrerpolicy"), "no-referrer");
        // It's in the details panel's place, and "Open in a new tab" is the link as it was.
        assert.equal(await page.locator(ID.details).isVisible(), false, "the panel makes room for it");
        assert.equal(await open(page).locator(CLASS.viewerOpen).getAttribute("href"), href);
        assert.equal(await open(page).locator(CLASS.viewerOpen).getAttribute("target"), "_blank");
      },
    },
    {
      name: "Escape closes the viewer, throws its frame away and gives the link the focus back",
      url: `#${tab}`,
      skip,
      async test(page) {
        await openViewer(page);
        await page.keyboard.press("Escape");
        await page.locator(CLASS.viewer).waitFor({ state: "hidden" });
        assert.equal(
          await page.locator(`${CLASS.viewer} iframe`).count(),
          0,
          "nothing is left loading from the other site",
        );
        assert.equal(await page.locator(CLASS.viewing).count(), 0, "the shell is as it was");
        assert.ok(
          await link(page).evaluate((el: Focusable) => el.ownerDocument.activeElement === el),
          "the focus is back on the link",
        );
        // And it opens again.
        await link(page).click();
        await open(page).locator("iframe").waitFor();
      },
    },
    {
      name: "a click with a modifier key is left to the browser: the viewer takes only a plain one",
      url: `#${tab}`,
      skip,
      async test(page) {
        await sitesReturnAPage(page, [href, shown]);
        for (const key of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
          assert.equal(await clickTaken(link(page), { [key]: true }), false, `a click with ${key} is the browser's`);
        }
        assert.equal(await open(page).count(), 0, "and the viewer stays shut");
        assert.equal(await clickTaken(link(page), {}), true, "a plain click is the viewer's");
        await open(page).waitFor();
      },
    },
    {
      name: "the panel's button brings the details panel back in the viewer's place",
      url: `#${tab}`,
      device: desktop,
      skip: skip ?? (site.panel.length ? null : "the site has no details panel"),
      async test(page) {
        await openViewer(page);
        await page.locator(`#${tab} [${DATA.panelToggle}]`).click();
        await page.locator(CLASS.viewer).waitFor({ state: "hidden" });
        await page.locator(ID.details).waitFor({ state: "visible" });
      },
    },
    {
      name: "on a phone the viewer covers the screen, and its button closes it",
      url: `#${tab}`,
      device: iPhone,
      skip,
      async test(page) {
        await openViewer(page);
        const size = page.viewportSize();
        assert.ok(size);
        await eventually(async () => {
          const box = await open(page).boundingBox();
          assert.deepEqual(
            box && [box.x, box.y, box.width, box.height].map(Math.round),
            [0, 0, size.width, size.height],
            "edge to edge",
          );
        });
        await open(page).locator(CLASS.viewerClose).click();
        await page.locator(CLASS.viewer).waitFor({ state: "hidden" });
        await page.locator(`#${tab} ${CLASS.thread}`).waitFor({ state: "visible" });
      },
    },
  ];
};
