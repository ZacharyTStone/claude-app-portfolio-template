/* The viewer: a link the config's `viewer` lists opens beside the
   conversation, in a frame. The site the frame's page comes from is stood
   in for here: the checks never use the network. */
import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { DATA } from "../../../src/contracts/page-attributes.ts";
import { desktop, eventually, hasFocus, iPhone, type Check, type PageElement } from "../helpers.ts";
import { CLASS, ID, type Site, type ViewerLink } from "../site.ts";

/** The page that stands in for whatever the viewer frames, and the words
    that show it has loaded. */
const FRAMED_TEXT = "A document, stood in for.";
const FRAMED_PAGE = `<!doctype html><title>A document</title><p>${FRAMED_TEXT}</p>`;

/** The viewer while it's open, and the frame it shows a page in. */
const OPEN_VIEWER = `${CLASS.viewer}:not([hidden])`;
const VIEWER_FRAME = `${CLASS.viewer} iframe`;

/** The keys that, held during a click, make it the browser's own: a new
    tab, a new window, a download. Each is a MouseEvent's name for it. */
const MODIFIER_KEYS = ["ctrlKey", "metaKey", "shiftKey", "altKey"];

// In a frame's sandbox, what would let the framed page send the whole tab
// somewhere else: "allow-top-navigation", or the same "-by-user-activation".
const LETS_THE_FRAME_NAVIGATE_THE_TAB = /allow-top-navigation/;

/** What stands in for the link on a site without a viewer, where every
    check here is skipped. */
const NO_VIEWER_LINK: ViewerLink = { tab: "", href: "", shown: "", title: "" };

/** The checks of the viewer, made for the first link on the site that
    opens in it. */
export default (site: Site): Check[] => {
  const viewerLink = site.viewer ?? NO_VIEWER_LINK;
  const skip = site.viewer ? null : "the site has no viewer";
  const { tab, href, shown, title } = viewerLink;
  /** The link, in its tab. */
  const link = (page: Page) => page.locator(`#${tab} a[${DATA.view}="${shown}"]`).first();
  /** Clicks the link, with its site and the one the viewer frames stood in
      for, and waits for the viewer. */
  async function openViewer(page: Page): Promise<Locator> {
    await sitesReturnAPage(page, [href, shown]);
    await link(page).click();
    const viewer = page.locator(OPEN_VIEWER);
    await viewer.waitFor();
    return viewer;
  }
  return [
    {
      name: "a link the viewer lists opens beside the conversation, in a frame from its site and nowhere else",
      url: `#${tab}`,
      skip,
      async test(page) {
        const viewer = await openViewer(page);
        const frame = viewer.locator("iframe");
        assert.equal(await frame.getAttribute("src"), shown, "the frame shows the address the config gives");
        assert.equal(
          await viewer.locator(CLASS.viewerTitle).textContent(),
          title,
          "the viewer is named as the config names the link",
        );
        // The page it shows loaded: the security policy let that site in.
        await page.frameLocator(VIEWER_FRAME).getByText(FRAMED_TEXT).waitFor();
        await eventually(async () => {
          assert.equal(
            await page.locator(`${CLASS.viewerFrame}${CLASS.viewerLoading}`).count(),
            0,
            "the viewer stops saying its page is loading",
          );
        });
        // The framed page can't take the visitor anywhere, and isn't told where they came from.
        const sandbox = (await frame.getAttribute("sandbox")) ?? "";
        assert.doesNotMatch(
          sandbox,
          LETS_THE_FRAME_NAVIGATE_THE_TAB,
          `the frame's sandbox doesn't let its page send the tab elsewhere: "${sandbox}"`,
        );
        assert.equal(
          await frame.getAttribute("referrerpolicy"),
          "no-referrer",
          "the framed site isn't told where the visitor came from",
        );
        // It's in the details panel's place, and "Open in a new tab" is the link as it was.
        assert.equal(await page.locator(ID.details).isVisible(), false, "the details panel makes room for the viewer");
        const openInNewTab = viewer.locator(CLASS.viewerOpen);
        assert.equal(await openInNewTab.getAttribute("href"), href, '"Open in a new tab" goes where the link goes');
        assert.equal(await openInNewTab.getAttribute("target"), "_blank", '"Open in a new tab" opens a new tab');
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
        assert.equal(await page.locator(VIEWER_FRAME).count(), 0, "nothing is left loading from the other site");
        assert.equal(await page.locator(CLASS.viewing).count(), 0, "the shell is as it was before the viewer opened");
        assert.ok(await hasFocus(link(page)), "the focus is back on the link");
        // And it opens again.
        await link(page).click();
        await page.locator(`${OPEN_VIEWER} iframe`).waitFor();
      },
    },
    {
      name: "a click with a modifier key is left to the browser: the viewer takes only a plain one",
      url: `#${tab}`,
      skip,
      async test(page) {
        await sitesReturnAPage(page, [href, shown]);
        for (const key of MODIFIER_KEYS) {
          assert.equal(
            await pageTakesClick(link(page), { [key]: true }),
            false,
            `a click with ${key} is left to the browser`,
          );
        }
        assert.equal(await page.locator(OPEN_VIEWER).count(), 0, "the viewer stays shut after those clicks");
        assert.equal(await pageTakesClick(link(page), {}), true, "a plain click is the viewer's");
        await page.locator(OPEN_VIEWER).waitFor();
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
        const viewer = await openViewer(page);
        const screen = page.viewportSize();
        assert.ok(screen, "the phone has a screen size");
        await eventually(async () => {
          const box = await viewer.boundingBox();
          assert.deepEqual(
            box && [box.x, box.y, box.width, box.height].map(Math.round),
            [0, 0, screen.width, screen.height],
            "the viewer covers the screen, edge to edge",
          );
        });
        await viewer.locator(CLASS.viewerClose).click();
        await page.locator(CLASS.viewer).waitFor({ state: "hidden" });
        await page.locator(`#${tab} ${CLASS.thread}`).waitFor({ state: "visible" });
      },
    },
  ];
};

/** Stands in for the sites of `addresses`, in this tab and any it opens:
    whatever is asked of them, they return FRAMED_PAGE. */
async function sitesReturnAPage(page: Page, addresses: string[]): Promise<void> {
  const origins = new Set(addresses.map((address) => new URL(address).origin));
  for (const origin of origins) {
    await page
      .context()
      .route(`${origin}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: FRAMED_PAGE }));
  }
}

/** Clicks a link with these keys held, and says whether the page took the
    click for itself: it stopped the browser following the link. Either way
    the link isn't followed, as the checks open no other site. */
const pageTakesClick = (link: Locator, keysHeld: Record<string, boolean>): Promise<boolean> =>
  link.evaluate((el: PageElement, held) => {
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
  }, keysHeld);
