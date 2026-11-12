/* What moves in an answer: a picture with its own animation moves in the
   page, under the page's real security headers, and a visitor who has
   asked for less motion is shown its still instead; a quote or a file card
   that's out of sight waits, and comes in once it's scrolled to. */
import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import {
  askInNewChat,
  askReturns,
  computedStyle,
  desktop,
  eventually,
  hasClass,
  OPEN_CHAT,
  type Check,
  type PageElement,
} from "../helpers.ts";
import { CLASS, COMES_INTO_VIEW, MOVING_PICTURE, type ComesIntoView, type MovingPicture, type Site } from "../site.ts";

/** What stands in for the picture on a site without one, where every check
    here is skipped. */
const NO_PICTURE: MovingPicture = { tab: "", index: 0, moving: "", still: "" };

/** How long to watch a picture for something in it to move. Every diagram
    has something moving within a second or two of any moment. */
const WATCH_MS = 6000;

/** How long a still picture is watched to see that nothing in it moves. */
const STILL_FOR_MS = 1500;

/** What stands in on a site with no quote or file card in an answer. */
const NOTHING_COMES_IN: ComesIntoView = { tab: "", answer: "" };

/** A window so short that the last quote or card of a tab is below it. */
const SHORT_WINDOW = { ...desktop, viewport: { width: 1440, height: 420 } };

/** The checks of a picture that moves, made for the first one on the site,
    and of what comes in as it's scrolled to, made for the tab with the
    most of it. */
export default (site: Site): Check[] => {
  const picture = site.movingPictures[0] ?? NO_PICTURE;
  const skip = site.movingPictures.length ? null : "the site has no picture that moves";
  const comingIn = site.comesIntoView ?? NOTHING_COMES_IN;
  const noneComeIn = site.comesIntoView ? null : "no answer on the site has a quote or a file card";
  const inItsTab = `#${comingIn.tab} ${COMES_INTO_VIEW}`;
  return [
    {
      name: "a quote or a card that's out of sight waits without moving the page, and comes in once it's scrolled to",
      url: `#${comingIn.tab}`,
      device: SHORT_WINDOW,
      skip: noneComeIn,
      async test(page) {
        const last = page.locator(inItsTab).last();
        await eventually(async () => {
          assert.ok(await hasClass(last, CLASS.waiting), "the tab's last quote or card, below the window, is waiting");
        });
        assert.equal(await computedStyle(last, "opacity"), "0", "what's waiting isn't shown");
        assert.notEqual(await computedStyle(last, "display"), "none", "what's waiting keeps its place in the page");
        await last.scrollIntoViewIfNeeded();
        await eventually(async () => {
          assert.ok(await hasClass(last, CLASS.seen), "scrolled to, it has come in");
          assert.equal(await computedStyle(last, "opacity"), "1", "and shows in full once it has");
        });
        assert.equal(await hasClass(last, CLASS.waiting), false, "it waits no longer");
      },
    },
    {
      name: "with motion reduced nothing waits: every quote and card shows from the start",
      url: `#${comingIn.tab}`,
      device: { ...SHORT_WINDOW, reducedMotion: "reduce" },
      skip: noneComeIn,
      async test(page) {
        await page.locator(`html${CLASS.js}`).waitFor();
        assert.equal(await page.locator(CLASS.waiting).count(), 0, "nothing in the page is waiting");
        assert.equal(
          await computedStyle(page.locator(inItsTab).last(), "opacity"),
          "1",
          "the tab's last quote or card shows",
        );
      },
    },
    {
      name: "a chat's copy of an answer shows whole: nothing in it waits to be scrolled to",
      url: "./",
      device: SHORT_WINDOW,
      skip: noneComeIn ?? site.noAsk,
      async test(page) {
        // /ask picks the answer the tab's last quote or card is in, which is
        // still waiting in its own tab when the chat copies it.
        await askReturns(page, site.askUrl, { id: comingIn.answer });
        await askInNewChat(page, "What do people say?");
        const copies = page.locator(`${OPEN_CHAT} ${COMES_INTO_VIEW}`);
        await copies.first().waitFor();
        assert.equal(await page.locator(`${OPEN_CHAT} ${CLASS.waiting}`).count(), 0, "nothing in the chat is waiting");
        for (const copy of await copies.all()) {
          assert.equal(await computedStyle(copy, "opacity"), "1", "each quote or card in the chat shows");
        }
      },
    },
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
