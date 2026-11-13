/* The viewer: a link the config's `viewer` lists opens beside the
   conversation, in a frame. The site the frame's page comes from is stood
   in for: the checks never use the network. */
import type { Locator, Page } from "@playwright/test";
import { DATA } from "../../src/contracts/page-attributes.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
} from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import type { ViewerLink } from "./site.ts";

const FRAMED_TEXT = "A document, stood in for.";
const FRAMED_PAGE = `<!doctype html><title>A document</title><p>${FRAMED_TEXT}</p>`;

const OPEN_VIEWER = `${CLASS.viewer}:not([hidden])`;
const VIEWER_FRAME = `${CLASS.viewer} iframe`;

// Held during a click, each makes it the browser's own: a new tab, a new window, a download.
const MODIFIER_KEYS = ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const;
type KeysHeld = Partial<Record<(typeof MODIFIER_KEYS)[number], boolean>>;

// What would let the framed page send the whole tab somewhere else: this, or the same "-by-user-activation".
const LETS_THE_FRAME_NAVIGATE_THE_TAB = /allow-top-navigation/;

const linkIn = (page: Page, { tab, shown }: ViewerLink): Locator =>
  page.locator(`#${tab} a[${DATA.viewerAddress}="${shown}"]`).first();

test.beforeEach(async ({ page, viewerLink }) => {
  await otherSitesReturnAPage(page, [viewerLink.href, viewerLink.shown]);
  await page.goto(`#${viewerLink.tab}`);
});

test.describe("a link the viewer lists, clicked", () => {
  test.beforeEach(async ({ page, viewerLink }) => {
    await linkIn(page, viewerLink).click();
    await expect(page.locator(OPEN_VIEWER)).toBeVisible();
  });

  test("opens in a frame, at the address and under the name the config gives", async ({ page, viewerLink }) => {
    const viewer = page.locator(OPEN_VIEWER);
    await expect(viewer.locator("iframe")).toHaveAttribute("src", viewerLink.shown);
    await expect(viewer.locator(CLASS.viewerTitle)).toHaveText(viewerLink.title);
  });

  test("shows the framed page: the security policy lets that site in", async ({ page }) => {
    await expect(page.frameLocator(VIEWER_FRAME).getByText(FRAMED_TEXT)).toBeVisible();
    await expect(
      page.locator(`${CLASS.viewerFrame}${CLASS.viewerLoading}`),
      "the viewer stops saying its page is loading",
    ).toHaveCount(0);
  });

  test("frames a page that can't send the tab elsewhere, and isn't told where the visitor came from", async ({
    page,
  }) => {
    const frame = page.locator(VIEWER_FRAME);
    await expect(frame).not.toHaveAttribute("sandbox", LETS_THE_FRAME_NAVIGATE_THE_TAB);
    await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  test('takes the details panel\'s place, with "Open in a new tab" going where the link goes', async ({
    page,
    viewerLink,
  }) => {
    await expect(page.locator(ID.panel), "the details panel makes room for the viewer").toBeHidden();
    const openInNewTab = page.locator(`${OPEN_VIEWER} ${CLASS.viewerOpen}`);
    await expect(openInNewTab).toHaveAttribute("href", viewerLink.href);
    await expect(openInNewTab).toHaveAttribute("target", "_blank");
  });

  test("closes on Escape, which throws its frame away and gives the link the focus back", async ({
    page,
    viewerLink,
  }) => {
    await page.keyboard.press("Escape");
    await expect(page.locator(CLASS.viewer)).toBeHidden();
    await expect(page.locator(VIEWER_FRAME), "nothing is left loading from the other site").toHaveCount(0);
    await expect(page.locator(CLASS.viewing), "the shell is as it was before the viewer opened").toHaveCount(0);
    await expect(linkIn(page, viewerLink)).toBeFocused();
  });

  test("opens again after it's closed", async ({ page, viewerLink }) => {
    await page.keyboard.press("Escape");
    await expect(page.locator(CLASS.viewer)).toBeHidden();
    await linkIn(page, viewerLink).click();
    await expect(page.locator(`${OPEN_VIEWER} iframe`)).toBeVisible();
  });

  test("gives its place back to the details panel when the panel's button is pressed", async ({
    page,
    site,
    viewerLink,
  }) => {
    test.skip(!site.panel.length, "the site has no details panel");
    await page.locator(`#${viewerLink.tab} ${ATTRIBUTE.panelToggle}`).click();
    await expect(page.locator(CLASS.viewer)).toBeHidden();
    await expect(page.locator(ID.panel)).toBeVisible();
  });
});

test("a click with a modifier key is left to the browser: the viewer takes only a plain one", async ({
  page,
  viewerLink,
}) => {
  const link = linkIn(page, viewerLink);
  for (const key of MODIFIER_KEYS) {
    expect(await pageTakesClick(link, { [key]: true }), `a click with ${key} is left to the browser`).toBe(false);
  }
  await expect(page.locator(OPEN_VIEWER), "the viewer stays shut after those clicks").toHaveCount(0);
  expect(await pageTakesClick(link, {}), "a plain click is the viewer's").toBe(true);
  await expect(page.locator(OPEN_VIEWER)).toBeVisible();
});

test.describe("on a phone", () => {
  test.use(A_PHONE);

  test("the viewer covers the screen, and its button closes it", async ({ page, viewerLink }) => {
    await linkIn(page, viewerLink).click();
    const viewer = page.locator(OPEN_VIEWER);
    const screen = page.viewportSize();
    expect(screen, "the phone has a screen size").not.toBeNull();
    await expect
      .poll(async () => edgesOf(await viewer.boundingBox()), "the viewer covers the screen, edge to edge")
      .toEqual([0, 0, screen?.width, screen?.height]);
    await viewer.locator(CLASS.viewerClose).click();
    await expect(page.locator(CLASS.viewer)).toBeHidden();
    await expect(page.locator(`#${viewerLink.tab} ${CLASS.thread}`)).toBeVisible();
  });
});

type Box = { x: number; y: number; width: number; height: number };

const edgesOf = (box: Box | null): number[] | null => box && [box.x, box.y, box.width, box.height].map(Math.round);

/** Stands in for the sites of `addresses`, in this tab and any it opens. */
async function otherSitesReturnAPage(page: Page, addresses: string[]): Promise<void> {
  const origins = new Set(addresses.map((address) => new URL(address).origin));
  for (const origin of origins) {
    await page
      .context()
      .route(`${origin}/**`, (route) => route.fulfill({ contentType: "text/html", body: FRAMED_PAGE }));
  }
}

/** Clicks a link with these keys held, and says whether the page took the
    click for itself. Either way the link isn't followed: the checks open no
    other site. */
const pageTakesClick = (link: Locator, keysHeld: KeysHeld): Promise<boolean> =>
  link.evaluate((element, held) => {
    let taken = false;
    // The window hears the click after everything in the page has.
    window.addEventListener(
      "click",
      (event) => {
        taken = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...held }));
    return taken;
  }, keysHeld);
