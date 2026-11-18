/* Each kind of page the site has, as axe-core reads it against WCAG 2.0 and
   2.1 at levels A and AA: the home page, a tab's page, the Writing tab, a
   post's own page, the 404 page and another language's home page; with the
   site's script and without it, on a wide screen and on a phone. A check
   fails on anything axe-core finds, and names each: its rule, how much it
   matters, and where on the page it is. */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { CLASS_SELECTOR as CLASS } from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";

const WCAG_A_AND_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** A path under the site's own that no page has. */
const NO_PAGE_HERE = "no-page-is-here/";

/** What Chromium's console says of the 404 page's own address. */
const NOT_FOUND = /status of 404/;

/** One thing axe-core found, on one line: "color-contrast (serious) at
    .intro: Element has insufficient color contrast of 4.15 …". */
type Finding = string;

async function findingsOn(page: Page): Promise<Finding[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_A_AND_AA).analyze();
  return violations.flatMap(({ id, impact, nodes }) =>
    nodes.map(({ target, failureSummary }) => {
      const why = (failureSummary ?? "").replace(/\s+/g, " ").trim();
      return `${id} (${impact ?? "no impact given"}) at ${target.join(" ")}: ${why}`;
    }),
  );
}

async function expectNothingFound(page: Page, path: string): Promise<void> {
  await page.goto(path);
  expect(await findingsOn(page), `what axe-core finds on ${path}`).toEqual([]);
}

/** The same checks, for each kind of visit. */
function checkEachKindOfPage(): void {
  test("the home page passes", async ({ page, site }) => {
    await expectNothingFound(page, site.home);
  });

  test("a tab's page passes", async ({ page, site }) => {
    await expectNothingFound(page, site.secondThread.path);
  });

  test("the Writing tab's page passes", async ({ page, writingTab }) => {
    await expectNothingFound(page, writingTab.path);
  });

  test("a post's own page passes", async ({ page, postInViewer }) => {
    await expectNothingFound(page, postInViewer.page);
  });

  test("the 404 page passes", async ({ page, site, pageErrors }) => {
    pageErrors.expected(NOT_FOUND);
    await expectNothingFound(page, `${site.home}${NO_PAGE_HERE}`);
  });

  test("another language's home page passes", async ({ page, site }) => {
    const [another] = site.languages;
    test.skip(!another, "the site is in one language");
    await expectNothingFound(page, another?.href ?? "");
  });
}

/** A page opened with JavaScript off runs no script at all, axe-core's
    included: its timers never fire. So the site's own script is answered
    with an empty file, which leaves the page as a visitor without
    JavaScript has it: the site has no <noscript>, and no other script. */
async function withoutTheSitesScript(page: Page): Promise<void> {
  await page.route("**/*.js", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
}

// With less motion, everything shows at once: axe-core reads colours as they
// are when it looks, and a part still fading in would read as faint. It's the
// same page once it has come in, and a part that waits to come into view
// (src/app/reveal-on-scroll.ts) is there to be read, not hidden.
test.use({ reducedMotion: "reduce" });

test.describe("with JavaScript", () => {
  checkEachKindOfPage();
});

test.describe("without JavaScript", () => {
  test.beforeEach(async ({ page }) => withoutTheSitesScript(page));

  test("the page read is the one without the script: the script never starts", async ({ page, site }) => {
    await page.goto(site.home);
    await expect(page.locator(`html${CLASS.js}`)).toHaveCount(0);
  });

  checkEachKindOfPage();
});

test.describe("on a phone", () => {
  test.use(A_PHONE);

  test.describe("with JavaScript", () => {
    checkEachKindOfPage();
  });

  test.describe("without JavaScript", () => {
    test.beforeEach(async ({ page }) => withoutTheSitesScript(page));
    checkEachKindOfPage();
  });
});
