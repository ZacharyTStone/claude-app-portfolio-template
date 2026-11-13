/* What moves in an answer. A picture a visitor plays rests as its still
   until its button is pressed, then moves where it is, under the page's
   real security headers, and rests again. A picture that moves all the
   time does, and a visitor who has asked for less motion is shown its
   still instead. A quote or a file card that's out of sight waits, and
   comes in once it's scrolled to. */
import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { DATA } from "../../../src/shared/page-data.ts";
import {
  askInNewChat,
  askReturns,
  computedStyle,
  desktop,
  eventually,
  hasClass,
  iPhone,
  OPEN_CHAT,
  squash,
  type Check,
  type PageElement,
} from "../helpers.ts";
import {
  CLASS,
  COMES_INTO_VIEW,
  MOVING_PICTURE,
  PLAY_BUTTON,
  PLAYED_FIGURE,
  PLAYING_PICTURE,
  type ComesIntoView,
  type MovingPicture,
  type PlayedPicture,
  type Site,
} from "../site.ts";

/** What stands in for the picture on a site without one, where every check
    here is skipped. */
const NO_PICTURE: MovingPicture = { tab: "", index: 0, moving: "", still: "" };
const NOTHING_TO_PLAY: PlayedPicture = { ...NO_PICTURE, answer: "" };

/** How long to watch a picture for something in it to move. Every diagram
    has something moving within a second or two of any moment. */
const WATCH_MS = 6000;

/** How much of a played picture is looked at for motion, from its top: its
    button is never there, in the middle at rest or in a corner as it
    plays, so what changes in it is the picture. */
const WATCHED_SHARE = 0.4;

/** A time to play for, in seconds, short enough to see a picture stop by
    itself: a check puts it in place of the picture's own. */
const A_MOMENT = "1";

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
  const skip = site.movingPictures.length ? null : "the site has no picture that moves all the time";
  const played = site.playedPictures[0] ?? NOTHING_TO_PLAY;
  const nothingPlays = site.playedPictures.length ? null : "the site has no picture a visitor plays";
  // A tab to leave a playing picture for.
  const elsewhere = [site.A, site.B, site.C].find((thread) => thread && thread.id !== played.tab);
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
      name: "a picture a visitor plays rests still and dimmed; its button plays it where it is, and pauses it again",
      url: `#${played.tab}`,
      skip: nothingPlays,
      async test(page) {
        const figure = await scrollToPlayed(page, `#${played.tab}`, played.index);
        const button = figure.locator(PLAY_BUTTON);
        const still = figure.locator("img").first();
        assert.equal(await fileShown(still), played.still, "at rest the picture shown is the still one");
        assert.equal(squash(await button.textContent()), site.words.play, "and its button says Play");
        assert.ok(Number(await computedStyle(still, "opacity")) < 1, "the still is dimmed while it rests");
        assert.equal(await figure.locator(CLASS.moving).count(), 0, "nothing is over it");

        await button.click();
        const moving = figure.locator(PLAYING_PICTURE);
        await moving.waitFor();
        assert.equal(await fileShown(moving), played.moving, "played, the picture over it is the one that moves");
        assert.equal(squash(await button.textContent()), site.words.pause, "and its button says Pause");
        // The page's policy lets a picture run its own animation: two looks
        // at it, a moment apart, differ.
        const firstLook = await topOf(page, moving);
        await eventually(async () => {
          assert.ok(
            !firstLook.equals(await topOf(page, moving)),
            "the picture has changed since it was first looked at",
          );
        }, WATCH_MS);

        await button.click();
        await eventually(async () => {
          assert.equal(await figure.locator(CLASS.moving).count(), 0, "paused, the moving picture is gone");
        });
        assert.equal(squash(await button.textContent()), site.words.play, "and its button says Play again");
      },
    },
    {
      name: "a played picture stops by itself once it has played through, and when its tab is left",
      url: `#${played.tab}`,
      skip: nothingPlays,
      async test(page) {
        const figure = await scrollToPlayed(page, `#${played.tab}`, played.index);
        const button = figure.locator(PLAY_BUTTON);
        // The picture says how long it plays; here, a moment.
        const playsFor = await button.getAttribute(DATA.play);
        assert.ok(Number(playsFor) > 0, "the button says how many seconds the picture plays");
        await playFor(button, A_MOMENT);
        await button.click();
        await figure.locator(PLAYING_PICTURE).waitFor();
        await eventually(async () => {
          assert.equal(await figure.locator(CLASS.moving).count(), 0, "played through, the moving picture is gone");
          assert.equal(squash(await button.textContent()), site.words.play, "and its button says Play");
        });

        if (!elsewhere) return;
        await playFor(button, playsFor ?? "");
        await button.click();
        await figure.locator(PLAYING_PICTURE).waitFor();
        await page.goto(site.url(`#${elsewhere.id}`));
        await eventually(async () => {
          assert.equal(await hasClass(figure, CLASS.playing), false, "in a tab that's been left, it has stopped");
        });
      },
    },
    {
      name: "on a phone, a playing picture's button is the pause icon alone, and keeps its name",
      url: `#${played.tab}`,
      device: iPhone,
      skip: nothingPlays,
      async test(page) {
        const figure = await scrollToPlayed(page, `#${played.tab}`, played.index);
        const button = figure.locator(PLAY_BUTTON);
        const word = button.locator(CLASS.label);
        const widthAtRest = (await word.boundingBox())?.width ?? 0;
        assert.ok(widthAtRest > 1, "at rest the button shows its word, Play");
        await button.tap();
        await figure.locator(PLAYING_PICTURE).waitFor();
        await eventually(async () => {
          assert.ok(((await word.boundingBox())?.width ?? 0) <= 1, "playing, the word is out of sight");
          const size = await button.boundingBox();
          assert.ok(
            size && Math.abs(size.width - size.height) <= 1,
            "and the button is as wide as it's tall: its icon",
          );
        });
        assert.equal(squash(await button.textContent()), site.words.pause, "it's still named Pause");
      },
    },
    {
      name: "without JavaScript, a played picture's button is a link to the picture as it moves, and its still isn't dimmed",
      url: `#${played.tab}`,
      device: { ...desktop, javaScriptEnabled: false },
      skip: nothingPlays,
      async test(page) {
        const figure = await scrollToPlayed(page, `#${played.tab}`, played.index);
        const still = figure.locator("img").first();
        assert.equal(await fileShown(still), played.still, "the picture shown is the still one");
        assert.equal(await computedStyle(still, "opacity"), "1", "at full strength: there's no playing it here");
        assert.equal(
          await figure.locator(PLAY_BUTTON).getAttribute("href"),
          played.moving,
          "its button links to the picture as it moves",
        );
      },
    },
    {
      name: "a chat's copy of an answer has its picture at rest, with a button that plays it there",
      url: "./",
      skip: nothingPlays ?? site.noAsk,
      async test(page) {
        await askReturns(page, site.askUrl, { id: played.answer });
        await askInNewChat(page, "How did it go?");
        const copy = await scrollToPlayed(page, OPEN_CHAT, 0);
        assert.equal(await copy.locator(CLASS.moving).count(), 0, "the copy's picture is at rest");
        await copy.locator(PLAY_BUTTON).click();
        await copy.locator(PLAYING_PICTURE).waitFor();
        assert.equal(await page.locator(CLASS.playing).count(), 1, "and it's the one picture playing");
      },
    },
    {
      name: "a picture that moves all the time is shown moving: its own file loads, and what it draws changes",
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
      name: "with motion reduced, a picture that moves all the time is shown still",
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
      name: "without JavaScript, a picture that moves all the time still does: the motion is the picture's own",
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
  await untilLoaded(image);
  return image;
}

/** The figure of a picture a visitor plays, the `index`th (from 0) in
    `within` (a tab, or a chat), scrolled to, with its still loaded. */
async function scrollToPlayed(page: Page, within: string, index: number): Promise<Locator> {
  const figure = page.locator(`${within} ${PLAYED_FIGURE}`).nth(index);
  await figure.scrollIntoViewIfNeeded();
  await untilLoaded(figure.locator("img").first());
  return figure;
}

/** Has a Play button say its picture plays for `seconds`, in place of
    what it says. */
const playFor = (button: Locator, seconds: string): Promise<void> =>
  button.evaluate((el: PageElement, { name, value }) => el.setAttribute(name, value), {
    name: DATA.play,
    value: seconds,
  });

/** Waits until an <img> has its picture. */
async function untilLoaded(image: Locator): Promise<void> {
  await eventually(async () => {
    assert.ok(
      await image.evaluate((img: LoadedImage) => img.complete === true && (img.naturalWidth ?? 0) > 0),
      "the picture has loaded",
    );
  });
}

/** A look at the top of a picture (WATCHED_SHARE of it), as it is on the
    screen now. */
async function topOf(page: Page, image: Locator): Promise<Buffer> {
  const box = await image.boundingBox();
  assert.ok(box, "the picture is on the page");
  return page.screenshot({ clip: { ...box, height: box.height * WATCHED_SHARE } });
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
