/* The checks not yet moved to Playwright Test's own form, each run as it
   is. This file goes when the last of them has. */
import { chromium, expect, test } from "@playwright/test";
import ask from "./checks/ask.ts";
import chats from "./checks/chats.ts";
import figures from "./checks/figures.ts";
import home from "./checks/home.ts";
import sidebar from "./checks/sidebar.ts";
import viewer from "./checks/viewer.ts";
import views from "./checks/views.ts";
import { desktop, VISITOR_ZONE, type Check } from "./helpers.ts";
import { serve } from "./server.ts";
import { readSite } from "./site.ts";
import { OWN_SITE } from "./sites.ts";

const CHECK_FILES = { home, ask, chats, sidebar, figures, viewer, views };
const WAIT_LIMIT_MS = 10_000;

// The checks are made for a site before any of them runs, so the site is read here.
const server = await serve(OWN_SITE.config, OWN_SITE.builtFolder);
const readingBrowser = await chromium.launch();
const site = await readSite(readingBrowser, server.home);
await readingBrowser.close();

for (const [file, checksFor] of Object.entries(CHECK_FILES)) {
  test.describe(file, () => {
    for (const check of checksFor(site)) declare(check);
  });
}

function declare({ name, url, device = desktop, skip, allowAsk = false, test: run }: Check): void {
  test(name, async ({ browser }) => {
    test.skip(Boolean(skip), skip ?? "");
    const context = await browser.newContext({ timezoneId: VISITOR_ZONE, ...device });
    context.setDefaultTimeout(WAIT_LIMIT_MS);
    const page = await context.newPage();
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (allowAsk && message.location().url === site.askUrl) return;
      problems.push(message.text());
    });
    await page.goto(site.url(url));
    await run(page);
    await context.close();
    expect(problems, "errors in the page or its console").toEqual([]);
  });
}
