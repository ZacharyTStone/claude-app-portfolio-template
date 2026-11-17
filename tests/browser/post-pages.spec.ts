/* A post's own page, on a site whose viewer shows its posts: the post's card
   opens it in the viewer, in a frame from the site itself, and the page
   reads on its own too. A card's own link is to the post where it was
   posted, which the checks never open: they never use the network. */
import type { Locator, Page } from "@playwright/test";
import { WRITING_TAB } from "../../src/config/writing.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { CLASS_SELECTOR as CLASS, ID_SELECTOR as ID } from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import type { PostInViewer } from "./site.ts";

const OPEN_VIEWER = `${CLASS.viewer}:not([hidden])`;
const VIEWER_FRAME = `${CLASS.viewer} iframe`;
const LINK_TO_THE_POST = `${CLASS.postSource} a`;

// All a post's page may do in the frame, typed out here and not imported: to let it do more (run a script,
// say, with "allow-scripts", which beside "allow-same-origin" would let it reach the page around it), someone
// has to change this line too.
const ALL_A_POSTS_PAGE_MAY_DO = "allow-same-origin allow-popups allow-popups-to-escape-sandbox";

const cardOf = (page: Page, post: PostInViewer): Locator =>
  page.locator(`#${WRITING_TAB} a[${DATA.viewerPost}="${post.page}"]`);

test.describe("a post's card, clicked", () => {
  test.beforeEach(async ({ page, writingTab, postInViewer }) => {
    await page.goto(writingTab.path);
    await cardOf(page, postInViewer).click();
    await expect(page.locator(OPEN_VIEWER)).toBeVisible();
  });

  test("opens the site's own page of the post in the viewer, under the post's title", async ({
    page,
    postInViewer,
  }) => {
    const viewer = page.locator(OPEN_VIEWER);
    await expect(viewer.locator("iframe")).toHaveAttribute("src", postInViewer.page);
    await expect(viewer.locator(CLASS.viewerTitle)).toHaveText(postInViewer.title);
    await expect(page.locator(ID.panel), "the details panel makes room for the viewer").toBeHidden();
  });

  test("shows the post's page: the security policy lets the site frame a page of its own", async ({
    page,
    postInViewer,
  }) => {
    await expect(page.frameLocator(VIEWER_FRAME).locator(`${CLASS.post} h1`)).toHaveText(postInViewer.title);
    await expect(
      page.locator(`${CLASS.viewerFrame}${CLASS.viewerLoading}`),
      "the viewer stops saying its page is loading",
    ).toHaveCount(0);
  });

  test("frames the page in exactly the sandbox meant for it, which runs no script", async ({ page }) => {
    const frame = page.locator(VIEWER_FRAME);
    await expect(frame).toHaveAttribute("sandbox", ALL_A_POSTS_PAGE_MAY_DO);
    await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  test('links to the post where it was posted, from "Open in a new tab" and from the page itself', async ({
    page,
    postInViewer,
  }) => {
    const openInNewTab = page.locator(`${OPEN_VIEWER} ${CLASS.viewerOpen}`);
    await expect(openInNewTab).toHaveAttribute("href", postInViewer.href);
    await expect(openInNewTab).toHaveAttribute("target", "_blank");
    const onThePage = page.frameLocator(VIEWER_FRAME).locator(LINK_TO_THE_POST);
    await expect(onThePage).toHaveAttribute("href", postInViewer.href);
    await expect(onThePage).toHaveAttribute("target", "_blank");
    await expect(onThePage).toHaveAttribute("rel", /\bnoreferrer\b/);
  });

  test("closes on Escape, which throws its frame away and gives the card the focus back", async ({
    page,
    postInViewer,
  }) => {
    await page.keyboard.press("Escape");
    await expect(page.locator(CLASS.viewer)).toBeHidden();
    await expect(page.locator(VIEWER_FRAME)).toHaveCount(0);
    await expect(cardOf(page, postInViewer)).toBeFocused();
  });
});

test("every post's card opens its own page, each under its own title", async ({
  page,
  writingTab,
  postInViewer: _,
}) => {
  await page.goto(writingTab.path);
  for (const post of writingTab.posts) {
    expect(post.page, "the post has a page of the site's own").not.toBeNull();
    await page.locator(`#${WRITING_TAB} a[href="${post.href}"]`).click();
    await expect(page.locator(VIEWER_FRAME)).toHaveAttribute("src", post.page ?? "");
    await expect(page.frameLocator(VIEWER_FRAME).locator(`${CLASS.post} h1`)).toHaveText(post.title ?? "");
  }
});

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  test("the card is a link to the post where it was posted, in a new tab", async ({
    page,
    writingTab,
    postInViewer,
  }) => {
    await page.goto(writingTab.path);
    const card = cardOf(page, postInViewer);
    await expect(card).toHaveAttribute("href", postInViewer.href);
    await expect(card).toHaveAttribute("target", "_blank");
  });

  test("the post's own page reads on its own: its title, then its link to the post, then its text", async ({
    page,
    postInViewer,
  }) => {
    await page.goto(postInViewer.page);
    await expect(page.locator(`${CLASS.post} h1`)).toHaveText(postInViewer.title);
    await expect(page.locator(LINK_TO_THE_POST)).toHaveAttribute("href", postInViewer.href);
    await expect(page.locator(`${CLASS.post} > :not(h1, ${CLASS.postSource})`).first()).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test.use(A_PHONE);

  test("the viewer covers the screen with the post's page", async ({ page, writingTab, postInViewer }) => {
    await page.goto(writingTab.path);
    await cardOf(page, postInViewer).click();
    const viewer = page.locator(OPEN_VIEWER);
    const screen = page.viewportSize();
    await expect
      .poll(async () => {
        const box = await viewer.boundingBox();
        return box && [box.x, box.y, box.width, box.height].map(Math.round);
      }, "the viewer covers the screen, edge to edge")
      .toEqual([0, 0, screen?.width, screen?.height]);
    await expect(page.frameLocator(VIEWER_FRAME).locator(`${CLASS.post} h1`)).toHaveText(postInViewer.title);
  });

  test("every post's page fits the screen: only its code and its tables scroll sideways, inside themselves", async ({
    page,
    writingTab,
    postInViewer: _,
  }) => {
    for (const post of writingTab.posts) {
      await page.goto(post.page ?? "");
      const column = page.locator(CLASS.post);
      await expect(column).toBeVisible();
      const pastTheScreen = await column.evaluate((main) => main.scrollWidth - main.clientWidth);
      expect(pastTheScreen, `how far ${post.page} reaches past the screen`).toBe(0);
    }
  });
});
