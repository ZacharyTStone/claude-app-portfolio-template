/* The site seen other ways: in its other languages, on a phone, without
   JavaScript and printed. */
import type { Locator, Page } from "@playwright/test";
import { SEPARATOR } from "../../src/app/constants.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
} from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import { OPEN_CARD, OPEN_CHAT, OPEN_DRAWER, sidebarRow } from "./parts.ts";
import { pickFirstTab } from "./visitor.ts";

/** How long the page has for what it should do at once, in milliseconds:
    shorter than the wait every check gets. */
const AT_ONCE_MS = 2000;

/** The most a printed colour's red, green and blue (0 to 255 each) may add
    up to and still be dark text on paper. */
const DARKEST_PRINT = 200;

/** The motion's speed while a check watches the drawer slide: a tenth, so
    there's time to see it on its way. */
const SLOW_MOTION_RATE = 0.1;

/** How a value is known to have settled: the same at this many looks
    running, this far apart, within this long (all in milliseconds). */
const SETTLED = { sameLooks: 3, lookEveryMs: 100, withinMs: 5000 };

test("each other language's page opens on the same tab, in its language", async ({ page, site }) => {
  test.skip(!site.languages.length, "the site is in one language");
  const tab = `#${site.firstThread.id}`;
  for (const { href, lang } of site.languages) {
    await test.step(`the ${lang} page`, async () => {
      await page.goto(`${href}${tab}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator(`${tab} ${CLASS.thread} > ${CLASS.question}`).first()).toBeVisible();
      // Only how it starts: the site's name was read from the main page, and this one may write it another way.
      const tabTitle = (await page.locator(`${tab} ${CLASS.titleText}`).innerText()).trim();
      await expect(page).toHaveTitle(new RegExp(`^${escaped(`${tabTitle}${SEPARATOR}`)}`));
    });
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test.beforeEach(async ({ page, site }) => {
    await page.goto(`#${lastThreadOf(site.threads)}`);
  });

  test("a tab still opens, and the home screen doesn't show behind it", async ({ page, site }) => {
    await expect(page.locator(`#${lastThreadOf(site.threads)} ${CLASS.thread}`)).toBeVisible();
    await expect(page.locator(ID.home)).toBeHidden();
  });

  test("Tab brings up no skip link: its link would close the tab", async ({ page }) => {
    await page.keyboard.press("Tab");
    await expect(page.locator(CLASS.skip)).toBeHidden();
  });
});

test.describe("printed", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await expect(page.locator(ID.greeting)).toBeVisible();
    await page.emulateMedia({ media: "print" });
  });

  test("who this is heads the page", async ({ page }) => {
    await expect(page.locator(CLASS.printHead)).toBeVisible();
  });

  test('the "Something else" tab isn\'t printed', async ({ page }) => {
    await expect(page.locator(ID.asked)).toBeHidden();
  });

  test("text that's light on the screen is printed dark", async ({ page, site }) => {
    // A status line's file name if there is one: it's light on the screen.
    const lightOnScreen = site.statusLine
      ? `${CLASS.tab} ${CLASS.status} summary b`
      : `${CLASS.tab} ${CLASS.thread} ${CLASS.answer} p`;
    const color = await page
      .locator(lightOnScreen)
      .first()
      .evaluate((text) => getComputedStyle(text).color);
    expect(lightness(color), `text is printed dark, not in ${color}`).toBeLessThan(DARKEST_PRINT);
  });
});

test.describe("on a phone", () => {
  test.use(A_PHONE);

  test.describe("a visit", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("./");
    });

    test("starts in a new chat that says who this is, with the question card open", async ({ page, site }) => {
      const whoThisIs = page.locator(`${CLASS.tab}${ATTRIBUTE.chat} ${CLASS.chatHello}`);
      await expect(whoThisIs.locator(CLASS.chatName)).toContainText(site.name);
      await expect(page.locator(OPEN_CARD)).toBeVisible();
    });

    test("has the site's one line under the name", async ({ page, site }) => {
      test.skip(!site.tagline, "the site has no line that says who this is");
      const whoThisIs = page.locator(`${CLASS.tab}${ATTRIBUTE.chat} ${CLASS.chatHello}`);
      expect(await whoThisIs.locator(CLASS.intro).textContent()).toBe(site.tagline);
    });

    test("keeps a reply's question in view, so the reply is read from its start", async ({ page }) => {
      await expect(page.locator(OPEN_CARD)).toBeVisible();
      await pickFirstTab(page);
      await expectQuestionInView(page, 0);
    });

    test("keeps the question in view under an earlier reply too", async ({ page }) => {
      await expect(page.locator(OPEN_CARD)).toBeVisible();
      await pickFirstTab(page);
      await expectQuestionInView(page, 0);
      await page.locator(`${CLASS.tab}${ATTRIBUTE.chat} ${CLASS.composer}`).click();
      await pickFirstTab(page);
      await expectQuestionInView(page, 1);
    });

    test("is a new chat again after Back from a tab, not the home screen", async ({ page, site }) => {
      const card = page.locator(OPEN_CARD);
      const chat = page.locator(OPEN_CHAT);
      await expect(card).toBeVisible();
      await chat.locator(CLASS.menuButton).click();
      await sidebarRow(page, site.firstThread.id).click();
      await expect(page.locator(`#${site.firstThread.id}:target`)).toBeVisible();
      // Once the page has caught up: the drawer closes on the hashchange.
      await expect(page.locator(OPEN_DRAWER)).toHaveCount(0);
      await page.goBack();
      await expect(chat).toBeVisible();
      await expect(card).toBeVisible();
      await expect(page.locator(ID.home)).toBeHidden();
    });
  });

  test("a figure and everything written in it fit the column", async ({ page, site }) => {
    test.skip(!site.figureTabs.length, "no thread has a figure");
    const screenWidth = page.viewportSize()?.width ?? 0;
    for (const tab of site.figureTabs) {
      await test.step(`in #${tab}`, async () => {
        await page.goto(`#${tab}`);
        const figures = page.locator(`#${tab} ${CLASS.figure}`);
        await expect(figures.first()).toBeVisible();
        expect(await figures.evaluateAll(wordsOutsideTheirFigure), "what's written past a figure's edge").toEqual([]);
        expect(
          await figures.evaluateAll(countPastTheScreen, screenWidth),
          `figures that reach past the screen's ${screenWidth}px`,
        ).toBe(0);
      });
    }
  });

  test("Share shows only its icon, and keeps its name", async ({ page, site }) => {
    await page.goto(`#${site.firstThread.id}`);
    const share = page.locator(`#${site.firstThread.id} ${ATTRIBUTE.copyLink}:has(${CLASS.label})`);
    const label = share.locator(CLASS.label);
    const name = (await label.innerText()).trim();
    expect(name, "Share's words are in the page").not.toBe("");
    await expect(page.getByRole("button", { name, exact: true }).and(share)).toBeVisible({ timeout: AT_ONCE_MS });
    const box = await label.boundingBox();
    expect(
      box && Math.max(box.width, box.height),
      "Share's words take no room: only its icon shows",
    ).toBeLessThanOrEqual(1);
  });

  test.describe("the drawer", () => {
    test.beforeEach(async ({ page, site }) => {
      await page.goto(`#${site.firstThread.id}`);
      await menuButtonOf(page, site.firstThread.id).click();
      await expect(page.locator(OPEN_DRAWER)).toBeVisible();
    });

    test("opens from the menu button, with the focus in it", async ({ page }) => {
      await expect(page.locator(`${ID.sidebar} :focus`)).toHaveCount(1);
    });

    test("closes on Escape, and the focus goes back to the menu button", async ({ page, site }) => {
      await page.keyboard.press("Escape");
      await expect(page.locator(OPEN_DRAWER)).toHaveCount(0);
      await expect(menuButtonOf(page, site.firstThread.id)).toBeFocused();
    });

    test("closes by its close button, and the focus goes back to the menu button", async ({ page, site }) => {
      await page.locator(`${ID.sidebar} ${CLASS.drawerClose}`).click();
      await expect(page.locator(OPEN_DRAWER)).toHaveCount(0);
      await expect(menuButtonOf(page, site.firstThread.id)).toBeFocused();
    });

    test("closes at once when a row opens its tab", async ({ page, otherThread }) => {
      await sidebarRow(page, otherThread.id).click();
      await expect(page.locator(`#${otherThread.id}:target`)).toBeVisible();
      await expect(page.locator(OPEN_DRAWER)).toHaveCount(0, { timeout: AT_ONCE_MS });
    });

    test("slides out before it's hidden", async ({ page }) => {
      await slowMotionTo(page, SLOW_MOTION_RATE);
      await page.keyboard.press("Escape");
      expect(await visibilityOf(page.locator(ID.sidebar)), "the drawer still shows as it slides out").toBe("visible");
      await expect(page.locator(ID.sidebar), "the drawer is hidden once it has slid out").toHaveCSS(
        "visibility",
        "hidden",
      );
    });
  });
});

const lastThreadOf = (threads: Array<{ id: string }>): string => threads.at(-1)?.id ?? "";

const menuButtonOf = (page: Page, tabId: string): Locator => page.locator(`#${tabId} ${CLASS.menuButton}`);

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const visibilityOf = (element: Locator): Promise<string> =>
  element.evaluate((shown) => getComputedStyle(shown).visibility);

/** The nth question of the phone's chat (from 0) is in view once its reply
    is in and the page has stopped scrolling: not scrolled past. */
async function expectQuestionInView(page: Page, nth: number): Promise<void> {
  const chat = page.locator(`${CLASS.tab}${ATTRIBUTE.chat}`);
  const question = chat.locator(`${CLASS.thread} > ${CLASS.question}`).nth(nth);
  await expect(chat.locator(`${CLASS.thread} > ${CLASS.answer}`).nth(nth)).toBeVisible();
  const shownOfThread = await chat.locator(CLASS.scroll).boundingBox();
  if (!shownOfThread) throw new Error("The chat's thread isn't on screen");
  const below = await settled(page, async () =>
    Math.round(((await question.boundingBox())?.y ?? NaN) - shownOfThread.y),
  );
  expect(below, "how far the question is below the top of what shows of the thread").toBeGreaterThanOrEqual(0);
  expect(below, "the question isn't below what shows of the thread").toBeLessThan(shownOfThread.height);
}

/** What `read` gives once it has stopped changing: for where something is
    once the page has stopped scrolling. */
async function settled<Value>(page: Page, read: () => Promise<Value>): Promise<Value> {
  const deadline = Date.now() + SETTLED.withinMs;
  let value = await read();
  for (let sameLooks = 1; sameLooks < SETTLED.sameLooks && Date.now() < deadline;) {
    await page.waitForTimeout(SETTLED.lookEveryMs);
    const next = await read();
    sameLooks = next === value ? sameLooks + 1 : 1;
    value = next;
  }
  return value;
}

/** The words of a figure's parts (its caption, labels, values and steps)
    that reach past its frame, for each figure: none, when everything in a
    figure fits it. It runs in the page. */
const wordsOutsideTheirFigure = (figures: Element[]): string[] =>
  figures.flatMap((figure) => {
    // Half a pixel either side: where the browser rounds a box.
    const rounding = 0.5;
    const frame = figure.getBoundingClientRect();
    return [...figure.querySelectorAll("figcaption, dt, dd, text, li")]
      .filter((part) => {
        const box = part.getBoundingClientRect();
        return box.left < frame.left - rounding || box.right > frame.right + rounding;
      })
      .map((part) => part.textContent ?? "");
  });

/** How many of the figures reach past either side of a screen this wide.
    It runs in the page. */
const countPastTheScreen = (figures: Element[], screenWidth: number): number =>
  figures.filter((figure) => {
    const { left, right } = figure.getBoundingClientRect();
    return left < 0 || right > screenWidth;
  }).length;

/** How light a CSS colour is ("rgb(26, 26, 26)"): its red, green and blue
    added up, from 0 for black to 765 for white. A colour that can't be read
    counts as white. */
function lightness(color: string): number {
  const [red = 255, green = 255, blue = 255] = (color.match(/\d+/g) ?? []).map(Number);
  return red + green + blue;
}

/** Plays the page's animations and transitions at `rate` times their speed
    from now on, through Chromium's DevTools. */
async function slowMotionTo(page: Page, rate: number): Promise<void> {
  const devTools = await page.context().newCDPSession(page);
  await devTools.send("Animation.enable");
  await devTools.send("Animation.setPlaybackRate", { playbackRate: rate });
}
