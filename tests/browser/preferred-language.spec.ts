/* A visitor whose browser would rather read another of the site's languages
   goes to its page when they come in at the main language's, until they
   pick a language themselves. */
import type { Page } from "@playwright/test";
import { CLASS_SELECTOR as CLASS, ID_SELECTOR as ID } from "../../src/contracts/page-selectors.ts";
import { ANY_OTHER_LANGUAGE, tabPagePath } from "../../src/contracts/tab-pages.ts";
import { expect, test } from "./fixtures.ts";
import { openTab } from "./parts.ts";

/** The browser says the visitor reads `language` first. */
async function prefer(page: Page, language: string): Promise<void> {
  await page.addInitScript((code) => Object.defineProperty(navigator, "languages", { get: () => [code] }), language);
}

/** The main language, as the page's head names its version for any other. */
async function mainLanguageOf(page: Page): Promise<string> {
  const mainHref = await page.locator(`link[rel="alternate"][hreflang="${ANY_OTHER_LANGUAGE}"]`).getAttribute("href");
  const versions = page.locator(`link[rel="alternate"][href="${mainHref}"]:not([hreflang="${ANY_OTHER_LANGUAGE}"])`);
  return (await versions.getAttribute("hreflang")) ?? "";
}

test("a visitor who reads another of the site's languages goes to the open tab's page in it", async ({
  page,
  site,
  baseURL,
}) => {
  const [other] = site.languages;
  test.skip(!other, "the site is in one language");
  await prefer(page, other?.lang ?? "");
  await page.goto(site.firstThread.path);
  await expect(page).toHaveURL(new URL(tabPagePath(other?.href ?? "", site.firstThread.id), baseURL).href);
  await expect(page.locator("html")).toHaveAttribute("lang", other?.lang ?? "");
  await expect(openTab(page, site.firstThread.id)).toBeVisible();
});

test("a visitor who picks the main language stays on its pages from then on", async ({ page, site, baseURL }) => {
  const [other] = site.languages;
  test.skip(!other, "the site is in one language");
  await prefer(page, other?.lang ?? "");
  await page.goto(site.firstThread.path);
  await expect(page.locator("html")).toHaveAttribute("lang", other?.lang ?? "");
  const main = await mainLanguageOf(page);
  await page.locator(`${ID.sidebar} ${CLASS.languageSwitch} a[hreflang="${main}"]`).click();
  await expect(page.locator("html")).toHaveAttribute("lang", main);
  await page.goto(site.firstThread.path);
  await expect(page).toHaveURL(new URL(site.firstThread.path, baseURL).href);
  await expect(page.locator("html")).toHaveAttribute("lang", main);
});
