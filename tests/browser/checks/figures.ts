/* Figures that move: a picture with its own animation moves in the page,
   under the page's real security headers, and a visitor who has asked for
   less motion is shown its still instead. */
import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { desktop, eventually, type Check, type PageElement } from "../helpers.ts";
import { MOVING_PICTURE, type MovingPicture, type Site } from "../site.ts";

/** What stands in for the picture on a site without one, where every check
    here is skipped. */
const NO_PICTURE: MovingPicture = { tab: "", index: 0, moving: "", still: "" };

/** How long to watch a picture for something in it to move. Every diagram
    has something moving within a second or two of any moment. */
const WATCH_MS = 6000;

/** How long a still picture is watched to see that nothing in it moves. */
const STILL_FOR_MS = 1500;

/** The checks of a picture that moves, made for the first one on the site. */
export default (site: Site): Check[] => {
  const picture = site.movingPictures[0] ?? NO_PICTURE;
  const skip = site.movingPictures.length ? null : "the site has no picture that moves";
  return [
    {
      name: "a picture that moves is shown moving: its own file loads, and what it draws changes",
      url: `#${picture.tab}`,
      skip,
      async test(page) {
        const image = await scrollTo(page, picture);
        assert.equal(await fileShown(image), picture.moving, "the picture shown is the one that moves");
        // The page's policy lets a picture run its own animation: two looks
        // at it, a moment apart, differ.
        const firstLook = await image.screenshot();
        await eventually(async () => {
          assert.ok(
            !firstLook.equals(await image.screenshot()),
            "the picture has changed since it was first looked at",
          );
        }, WATCH_MS);
      },
    },
    {
      name: "with motion reduced, a picture that moves is shown still",
      url: `#${picture.tab}`,
      device: { ...desktop, reducedMotion: "reduce" },
      skip,
      async test(page) {
        const image = await scrollTo(page, picture);
        assert.equal(await fileShown(image), picture.still, "the picture shown is the still one");
        const firstLook = await image.screenshot();
        await page.waitForTimeout(STILL_FOR_MS);
        assert.ok(firstLook.equals(await image.screenshot()), "nothing in the still picture has moved");
      },
    },
    {
      name: "without JavaScript, a picture still moves: the motion is the picture's own",
      url: `#${picture.tab}`,
      device: { ...desktop, javaScriptEnabled: false },
      skip,
      async test(page) {
        const image = await scrollTo(page, picture);
        const firstLook = await image.screenshot();
        await eventually(async () => {
          assert.ok(
            !firstLook.equals(await image.screenshot()),
            "the picture has changed since it was first looked at",
          );
        }, WATCH_MS);
      },
    },
  ];
};

/** The picture's <img>, in its tab, scrolled to and loaded. */
async function scrollTo(page: Page, picture: MovingPicture): Promise<Locator> {
  const image = page.locator(`#${picture.tab} ${MOVING_PICTURE} img`).nth(picture.index);
  await image.scrollIntoViewIfNeeded();
  await eventually(async () => {
    assert.ok(
      await image.evaluate((img: LoadedImage) => img.complete === true && (img.naturalWidth ?? 0) > 0),
      "the picture has loaded",
    );
  });
  return image;
}

/** An <img>, as far as these checks read it. What only an image has is
    optional here, since a locator's element is typed as any element. */
type LoadedImage = Pick<PageElement, "getAttribute"> & {
  complete?: boolean;
  naturalWidth?: number;
  currentSrc?: string;
};

/** The file an <img> is showing, as a path on the site: its own `src`, or
    the <source> the browser picked in its place. */
const fileShown = (image: Locator): Promise<string> =>
  image.evaluate((img: LoadedImage) => new URL(img.currentSrc ?? "").pathname);
