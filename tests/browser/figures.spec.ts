/* What moves in an answer. A picture a visitor plays rests as its still
   until its button is pressed, then moves where it is, under the page's
   real security headers, and rests again. A picture that moves all the
   time does, and a visitor who has asked for less motion is shown its
   still instead. A quote or a file card that's out of sight waits, and
   comes in once it's scrolled to. */
import type { Locator, Page } from "@playwright/test";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import { CLASS_SELECTOR as CLASS } from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import { OPEN_CHAT } from "./parts.ts";
import {
  COMES_INTO_VIEW,
  MOVING_PICTURE,
  PLAY_BUTTON,
  PLAYED_FIGURE,
  PLAYING_PICTURE,
  type MovingPicture,
  type PlayedPicture,
} from "./site.ts";
import { askInNewChat } from "./visitor.ts";

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

/** A window so short that the last quote or card of a tab is below it. */
const A_SHORT_WINDOW = { width: 1440, height: 420 };

test.describe("a quote or a file card below a short window", () => {
  test.use({ viewport: A_SHORT_WINDOW });

  test.beforeEach(async ({ page, comingIntoView }) => {
    await page.goto(`#${comingIntoView.tab}`);
  });

  test("waits: it isn't shown, and keeps its place in the page", async ({ page, comingIntoView }) => {
    const last = lastToComeIn(page, comingIntoView.tab);
    await expect(last).toContainClass(PAGE_CLASSES.waiting);
    await expect(last).toHaveCSS("opacity", "0");
    await expect(last).not.toHaveCSS("display", "none");
  });

  test("comes in once it's scrolled to, shows in full and waits no longer", async ({ page, comingIntoView }) => {
    const last = lastToComeIn(page, comingIntoView.tab);
    await expect(last).toContainClass(PAGE_CLASSES.waiting);
    await last.scrollIntoViewIfNeeded();
    await expect(last).toContainClass(PAGE_CLASSES.seen);
    await expect(last).toHaveCSS("opacity", "1");
    await expect(last).not.toContainClass(PAGE_CLASSES.waiting);
  });

  test.describe("with motion reduced", () => {
    test.use({ reducedMotion: "reduce" });

    test("shows from the start: nothing in the page waits", async ({ page, comingIntoView }) => {
      await expect(page.locator(`html${CLASS.js}`)).toBeVisible();
      await expect(page.locator(CLASS.waiting)).toHaveCount(0);
      await expect(lastToComeIn(page, comingIntoView.tab)).toHaveCSS("opacity", "1");
    });
  });

  test("shows whole in a chat's copy of its answer: nothing there waits to be scrolled to", async ({
    page,
    site,
    ask,
    comingIntoView,
  }) => {
    test.skip(!site.ask, "Ask is off");
    // /ask picks the answer the tab's last quote or card is in, which is
    // still waiting in its own tab when the chat copies it.
    await ask.returns({ id: comingIntoView.answer });
    await page.goto("./");
    await askInNewChat(page, "What do people say?");
    const copies = page.locator(`${OPEN_CHAT} ${COMES_INTO_VIEW}`);
    await expect(copies.first()).toBeVisible();
    await expect(page.locator(`${OPEN_CHAT} ${CLASS.waiting}`)).toHaveCount(0);
    for (const copy of await copies.all()) await expect(copy).toHaveCSS("opacity", "1");
  });
});

test.describe("a picture a visitor plays", () => {
  test.beforeEach(async ({ page, playedPicture }) => {
    await page.goto(`#${playedPicture.tab}`);
  });

  test("rests as its still, dimmed, under a button that says Play", async ({ page, site, playedPicture }) => {
    const figure = await scrollToItsTabs(page, playedPicture);
    const still = figure.locator("img").first();
    expect(await fileShown(still)).toBe(playedPicture.still);
    await expect(figure.locator(PLAY_BUTTON)).toHaveText(site.words.play);
    expect(await opacityOf(still), "the still is dimmed while it rests").toBeLessThan(1);
    await expect(figure.locator(CLASS.moving), "nothing is over the still").toHaveCount(0);
  });

  test("played, has the picture that moves over it, moving, and its button says Pause", async ({
    page,
    site,
    playedPicture,
  }) => {
    const figure = await scrollToItsTabs(page, playedPicture);
    await figure.locator(PLAY_BUTTON).click();
    const moving = figure.locator(PLAYING_PICTURE);
    await expect(moving).toBeVisible();
    expect(await fileShown(moving)).toBe(playedPicture.moving);
    await expect(figure.locator(PLAY_BUTTON)).toHaveText(site.words.pause);
    // The page's policy lets a picture run its own animation.
    await expectToChange(() => topOf(page, moving));
  });

  test("paused, loses the moving picture, and its button says Play again", async ({ page, site, playedPicture }) => {
    const figure = await scrollToItsTabs(page, playedPicture);
    const button = figure.locator(PLAY_BUTTON);
    await button.click();
    await expect(figure.locator(PLAYING_PICTURE)).toBeVisible();
    await button.click();
    await expect(figure.locator(CLASS.moving)).toHaveCount(0);
    await expect(button).toHaveText(site.words.play);
  });

  test("says how long it plays, and stops by itself once it has played through", async ({
    page,
    site,
    playedPicture,
  }) => {
    const figure = await scrollToItsTabs(page, playedPicture);
    const button = figure.locator(PLAY_BUTTON);
    expect(Number(await button.getAttribute(DATA.play)), "the seconds the button says it plays").toBeGreaterThan(0);
    await playFor(button, A_MOMENT);
    await button.click();
    await expect(figure.locator(PLAYING_PICTURE)).toBeVisible();
    await expect(figure.locator(CLASS.moving)).toHaveCount(0);
    await expect(button).toHaveText(site.words.play);
  });

  test("stops when its tab is left", async ({ page, site, playedPicture }) => {
    const elsewhere = [site.firstThread, site.secondThread].find((thread) => thread.id !== playedPicture.tab);
    test.skip(!elsewhere, "the sidebar has one thread");
    const figure = await scrollToItsTabs(page, playedPicture);
    await figure.locator(PLAY_BUTTON).click();
    await expect(figure.locator(PLAYING_PICTURE)).toBeVisible();
    await page.goto(`#${elsewhere?.id}`);
    await expect(figure).not.toContainClass(PAGE_CLASSES.playing);
  });

  test("plays in a chat's copy of its answer too, where it starts at rest", async ({
    page,
    site,
    ask,
    playedPicture,
  }) => {
    test.skip(!site.ask, "Ask is off");
    await ask.returns({ id: playedPicture.answer });
    await page.goto("./");
    await askInNewChat(page, "How did it go?");
    const copy = await scrollToPlayed(page, OPEN_CHAT, 0);
    await expect(copy.locator(CLASS.moving), "the copy's picture is at rest").toHaveCount(0);
    await copy.locator(PLAY_BUTTON).click();
    await expect(copy.locator(PLAYING_PICTURE)).toBeVisible();
    await expect(page.locator(CLASS.playing), "it's the one picture playing").toHaveCount(1);
  });

  test.describe("on a phone", () => {
    test.use(A_PHONE);

    test("has a button that's the pause icon alone while it plays, and keeps its name", async ({
      page,
      site,
      playedPicture,
    }) => {
      const figure = await scrollToItsTabs(page, playedPicture);
      const button = figure.locator(PLAY_BUTTON);
      const word = button.locator(CLASS.label);
      expect(await widthOf(word), "at rest the button shows its word, Play").toBeGreaterThan(1);
      await button.tap();
      await expect(figure.locator(PLAYING_PICTURE)).toBeVisible();
      await expect.poll(() => widthOf(word), "playing, the word is out of sight").toBeLessThanOrEqual(1);
      await expect.poll(() => widthLessHeightOf(button), "the button is as wide as it's tall").toBeLessThanOrEqual(1);
      await expect(button).toHaveText(site.words.pause);
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("has a button that links to the picture as it moves, and a still at full strength", async ({
      page,
      playedPicture,
    }) => {
      const figure = await scrollToItsTabs(page, playedPicture);
      const still = figure.locator("img").first();
      expect(await fileShown(still)).toBe(playedPicture.still);
      await expect(still, "there's no playing it here, so it isn't dimmed").toHaveCSS("opacity", "1");
      await expect(figure.locator(PLAY_BUTTON)).toHaveAttribute("href", playedPicture.moving);
    });
  });
});

test.describe("a picture that moves all the time", () => {
  test.beforeEach(async ({ page, movingPicture }) => {
    await page.goto(`#${movingPicture.tab}`);
  });

  test("is shown moving: its own file loads, and what it draws changes", async ({ page, movingPicture }) => {
    const image = await scrollToMoving(page, movingPicture);
    expect(await fileShown(image)).toBe(movingPicture.moving);
    // The page's policy lets a picture run its own animation.
    await expectToChange(() => image.screenshot());
  });

  test.describe("with motion reduced", () => {
    test.use({ reducedMotion: "reduce" });

    test("is shown still", async ({ page, movingPicture }) => {
      const image = await scrollToMoving(page, movingPicture);
      expect(await fileShown(image)).toBe(movingPicture.still);
      const firstLook = await image.screenshot();
      await page.waitForTimeout(STILL_FOR_MS);
      expect(firstLook.equals(await image.screenshot()), "nothing in the still picture has moved").toBe(true);
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("still moves: the motion is the picture's own", async ({ page, movingPicture }) => {
      const image = await scrollToMoving(page, movingPicture);
      await expectToChange(() => image.screenshot());
    });
  });
});

const lastToComeIn = (page: Page, tabId: string): Locator => page.locator(`#${tabId} ${COMES_INTO_VIEW}`).last();

/** The picture's <img>, in its tab, scrolled to and loaded. */
async function scrollToMoving(page: Page, picture: MovingPicture): Promise<Locator> {
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

/** The figure of a site's played picture, in its own tab. */
const scrollToItsTabs = (page: Page, { tab, index }: PlayedPicture): Promise<Locator> =>
  scrollToPlayed(page, `#${tab}`, index);

/** Has a Play button say its picture plays for `seconds`, in place of
    what it says. */
const playFor = (button: Locator, seconds: string): Promise<void> =>
  button.evaluate((element, { name, value }) => element.setAttribute(name, value), { name: DATA.play, value: seconds });

const untilLoaded = (image: Locator): Promise<void> =>
  expect
    .poll(() =>
      image.evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0),
    )
    .toBe(true);

/** A look at the top of a picture (WATCHED_SHARE of it), as it is on the
    screen now. */
async function topOf(page: Page, image: Locator): Promise<Buffer> {
  const box = await image.boundingBox();
  if (!box) throw new Error("The picture isn't on the page to look at");
  return page.screenshot({ clip: { ...box, height: box.height * WATCHED_SHARE } });
}

/** Two looks at a picture, a moment apart, differ: something in it moves. */
async function expectToChange(look: () => Promise<Buffer>): Promise<void> {
  const firstLook = await look();
  await expect
    .poll(async () => firstLook.equals(await look()), {
      message: "the picture is as it was when first looked at",
      timeout: WATCH_MS,
    })
    .toBe(false);
}

/** The file an <img> is showing, as a path on the site: its own `src`, or
    the <source> the browser picked in its place. */
const fileShown = (image: Locator): Promise<string> =>
  image.evaluate((img) => new URL((img as HTMLImageElement).currentSrc).pathname);

const opacityOf = (element: Locator): Promise<number> =>
  element.evaluate((shown) => Number(getComputedStyle(shown).opacity));

const widthOf = async (element: Locator): Promise<number> => (await element.boundingBox())?.width ?? 0;

/** How far from square an element is, in pixels: 0 for one as wide as it's
    tall. NaN, which no check passes on, for one that isn't on the page. */
async function widthLessHeightOf(element: Locator): Promise<number> {
  const box = await element.boundingBox();
  return box ? Math.abs(box.width - box.height) : NaN;
}
