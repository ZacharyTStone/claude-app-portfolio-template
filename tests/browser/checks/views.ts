/* The site seen other ways: in its other languages, on a phone, without
   JavaScript and printed. */
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { DATA } from "../../../src/contracts/page-attributes.ts";
import { SEPARATOR } from "../../../src/app/constants.ts";
import {
  computedStyle,
  desktop,
  eventually,
  iPhone,
  OPEN_CARD,
  OPEN_CHAT,
  OPEN_DRAWER,
  waitForTabToOpen,
  pickFirstTab,
  reportSkip,
  settled,
  settledTitle,
  sidebarRow,
  squash,
  type Check,
  type PageElement,
} from "../helpers.ts";
import { CLASS, ID, type LanguagePage, type Site } from "../site.ts";

/** How long the page has for what it should do at once, in milliseconds:
    shorter than the wait every check gets. */
const AT_ONCE_MS = 2000;

/** The most a printed colour's red, green and blue (0 to 255 each) may add
    up to and still be dark text on paper. */
const DARKEST_PRINT = 200;

/** The motion's speed while a check watches the drawer slide: a tenth, so
    there's time to see it on its way. */
const SLOW_MOTION_RATE = 0.1;

/** The checks of the site seen other ways, made for the site as it was
    read: one for each of its other languages among them. */
export default (site: Site): Check[] => {
  const { A, C } = site;
  const lastThread = site.threads.at(-1) ?? A;
  return [
    {
      name: "a phone starts in a new chat that says who this is",
      url: "./",
      device: iPhone,
      async test(page) {
        const whoThisIs = page.locator(`${CLASS.tab}[${DATA.chat}] ${CLASS.chatHello}`);
        await whoThisIs.locator(CLASS.chatName).filter({ hasText: site.name }).waitFor();
        if (site.tagline) {
          assert.equal(
            await whoThisIs.locator(CLASS.intro).textContent(),
            site.tagline,
            "the site's one line is under the name",
          );
        }
        await page.locator(OPEN_CARD).waitFor();
      },
    },
    {
      name: "on a phone, a reply is read from its start: its question stays in view, not scrolled past",
      url: "./",
      device: iPhone,
      async test(page) {
        const chat = page.locator(`${CLASS.tab}[${DATA.chat}]`);
        const thread = chat.locator(CLASS.thread);
        await page.locator(OPEN_CARD).waitFor();
        // Into an empty thread, then under what's already in it.
        for (const [nth, when] of ["in a new chat", "under an earlier reply"].entries()) {
          // The second time, the card is opened again from the composer.
          if (nth > 0) await chat.locator(CLASS.composer).click();
          await pickFirstTab(page);
          const question = thread.locator(`> ${CLASS.question}`).nth(nth);
          await thread.locator(`> ${CLASS.answer}`).nth(nth).waitFor();
          const shownOfThread = await chat.locator(CLASS.scroll).boundingBox();
          assert.ok(shownOfThread, "the thread is on screen");
          // How far the question is below the top of what's shown of the
          // thread, once the page has stopped scrolling.
          const below = await settled(page, async () =>
            Math.round(((await question.boundingBox())?.y ?? NaN) - shownOfThread.y),
          );
          assert.ok(
            below >= 0 && below < shownOfThread.height,
            `${when}, the question is in view: it's ${below}px below the top of the thread, ${shownOfThread.height}px of which shows`,
          );
        }
      },
    },
    {
      name: "on a phone, a figure and everything written in it fit the column",
      url: "./",
      device: iPhone,
      skip: site.figureTabs.length ? null : "no thread has a figure",
      async test(page) {
        const screenWidth = page.viewportSize()?.width ?? 0;
        for (const tab of site.figureTabs) {
          await page.goto(site.url(`#${tab}`));
          const figures = page.locator(`#${tab} ${CLASS.figure}`);
          await figures.first().waitFor();
          assert.deepEqual(
            await figures.evaluateAll(wordsOutsideTheirFigure),
            [],
            `in #${tab}, nothing written in a figure reaches past the figure's edge`,
          );
          for (const figure of await figures.all()) {
            const box = await figure.boundingBox();
            assert.ok(
              box && box.x >= 0 && box.x + box.width <= screenWidth,
              `every figure in #${tab} is within the screen's ${screenWidth}px`,
            );
          }
        }
      },
    },
    ...otherLanguageChecks(site),
    {
      name: "without JavaScript, a tab still opens",
      url: `#${lastThread.id}`,
      device: { ...desktop, javaScriptEnabled: false },
      async test(page) {
        assert.ok(await page.locator(`#${lastThread.id} ${CLASS.thread}`).isVisible(), "the tab's thread shows");
        assert.ok(!(await page.locator(ID.top).isVisible()), "the home screen doesn't show behind the tab");
        // Its link would close the tab, so there's no skip link.
        await page.keyboard.press("Tab");
        assert.ok(await page.locator(CLASS.skip).isHidden(), "Tab brings up no skip link");
      },
    },
    {
      name: "on a phone, Back to where the visit started is a new chat again, not the home screen",
      url: "./",
      device: iPhone,
      async test(page) {
        const card = page.locator(OPEN_CARD);
        const chat = page.locator(OPEN_CHAT);
        await card.waitFor();
        await chat.locator(CLASS.menu).click();
        await sidebarRow(page, A.id).click();
        await waitForTabToOpen(page, A.id);
        // Once the page has caught up (the drawer closes on the hashchange).
        await page.locator(OPEN_DRAWER).waitFor({ state: "detached" });
        await page.goBack();
        await chat.waitFor();
        await card.waitFor();
        assert.ok(await page.locator(ID.top).isHidden(), "Back doesn't show the home screen");
      },
    },
    {
      name: "printed: who this is first, dark text, no 'Something else'",
      url: "./",
      async test(page) {
        await page.locator(ID.hello).waitFor();
        await page.emulateMedia({ media: "print" });
        assert.ok(await page.locator(CLASS.printHead).isVisible(), "who this is heads the printed page");
        assert.ok(!(await page.locator(ID.asked).isVisible()), 'the "Something else" tab isn\'t printed');
        // A status line's file name if there is one: it's light on the screen.
        const lightOnScreen = site.statusLine
          ? `${CLASS.tab} ${CLASS.status} summary b`
          : `${CLASS.tab} ${CLASS.thread} ${CLASS.answer} p`;
        const color = await computedStyle(page.locator(lightOnScreen).first(), "color");
        assert.ok(lightness(color) < DARKEST_PRINT, `text is printed dark, not in ${color}`);
      },
    },
    {
      name: "on a phone, Share shows only its icon, and keeps its name",
      url: `#${A.id}`,
      device: iPhone,
      async test(page) {
        const share = page.locator(`#${A.id} [${DATA.copyLink}]:has(${CLASS.label})`);
        const label = share.locator(CLASS.label);
        const name = squash(await label.textContent());
        assert.ok(name, "Share's words are in the page");
        // It's still a button called by those words.
        await page.getByRole("button", { name, exact: true }).and(share).waitFor({ timeout: AT_ONCE_MS });
        const box = await label.boundingBox();
        assert.ok(box && box.width <= 1 && box.height <= 1, "Share's words take no room: only its icon shows");
      },
    },
    {
      name: "on a phone the menu button opens the drawer, and Escape, its close button or a row closes it",
      url: `#${A.id}`,
      device: iPhone,
      async test(page) {
        const drawer = page.locator(OPEN_DRAWER);
        const menuButton = page.locator(`#${A.id} ${CLASS.menu}`);
        const menuButtonWithFocus = page.locator(`#${A.id} ${CLASS.menu}:focus`);
        await menuButton.click();
        await drawer.waitFor();
        assert.equal(await page.locator(`${ID.tabs} :focus`).count(), 1, "the focus is in the drawer");

        await page.keyboard.press("Escape");
        assert.equal(await drawer.count(), 0, "Escape closes the drawer");
        await menuButtonWithFocus.waitFor();

        await menuButton.click();
        await page.locator(`${ID.tabs} ${CLASS.drawerClose}`).click();
        assert.equal(await drawer.count(), 0, "the drawer's close button closes it");
        await menuButtonWithFocus.waitFor();

        if (!C) return reportSkip("a row closing the phone drawer", "the sidebar has one thread");
        await menuButton.click();
        await sidebarRow(page, C.id).click();
        await waitForTabToOpen(page, C.id);
        // Once the tab's open (on the hashchange after it).
        await drawer.waitFor({ state: "detached", timeout: AT_ONCE_MS });
      },
    },
    {
      name: "on a phone the drawer slides out before it's hidden",
      url: `#${A.id}`,
      device: iPhone,
      async test(page) {
        const drawerVisibility = () => computedStyle(page.locator(ID.tabs), "visibility");
        await page.locator(`#${A.id} ${CLASS.menu}`).click();
        await page.locator(OPEN_DRAWER).waitFor();
        await slowMotionTo(page, SLOW_MOTION_RATE);
        await page.keyboard.press("Escape");
        assert.equal(await drawerVisibility(), "visible", "the drawer still shows as it slides out");
        await eventually(async () =>
          assert.equal(await drawerVisibility(), "hidden", "the drawer is hidden once it has slid out"),
        );
      },
    },
  ];
};

/** A check for each of the site's other languages: its page opens on the
    tab the link names. A site in one language gets a check that's skipped,
    and says so. */
function otherLanguageChecks(site: Site): Check[] {
  if (!site.languages.length) {
    const nothingToCheck = async () => {};
    return [{ name: "another language's page", url: "./", skip: "the site is in one language", test: nothingToCheck }];
  }
  return site.languages.map(({ href, lang }: LanguagePage): Check => ({
    name: `the ${lang} page, on the same tab`,
    url: `${href}#${site.A.id}`,
    async test(page) {
      assert.equal(await page.locator("html").getAttribute("lang"), lang, "the page is in the link's language");
      const tabTitle = squash(await page.locator(`#${site.A.id} ${CLASS.titleText}`).textContent());
      await page.locator(`#${site.A.id} ${CLASS.thread} > ${CLASS.question}`).first().waitFor();
      // Only how it starts: the site's name was read from the main page,
      // and this one may write it another way.
      const startsWithTheTab = (title: string) => title.startsWith(`${tabTitle}${SEPARATOR}`);
      assert.ok(
        startsWithTheTab(await settledTitle(page, startsWithTheTab)),
        "the window title starts with the tab's name",
      );
    },
  }));
}

/** The words of a figure's parts (its caption, labels, values and steps)
    that reach past its frame, for each figure: none, when everything in a
    figure fits it. It runs in the page. */
const wordsOutsideTheirFigure = (figures: PageElement[]): string[] =>
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
