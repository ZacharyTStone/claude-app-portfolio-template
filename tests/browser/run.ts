/* The built site in a real browser (npm run verify runs this, and so CI):

     npm run test:browser

   It serves the built site as the host does (server.ts: under the site's base
   path, with the real security headers, so the Content-Security-Policy and
   Trusted Types apply), reads what the site has (site.ts), and runs each
   check in checks/ in a fresh Chromium context. It needs no network, and
   fails on any check, and on any error in the page or the console (a
   blocked request included).

   The checks find what to look for in the built page itself (its tabs, its
   question card, its wording), so they work for any site.config.ts. A check
   for something a site doesn't have (Ask, personal answers, another
   language) is skipped, and says so. Needs Playwright's Chromium
   (`npx playwright install chromium`); nothing else. */
import { chromium } from "playwright";
import config from "../../site.config.ts";
import ask from "./checks/ask.ts";
import chats from "./checks/chats.ts";
import figures from "./checks/figures.ts";
import home from "./checks/home.ts";
import sidebar from "./checks/sidebar.ts";
import viewer from "./checks/viewer.ts";
import views from "./checks/views.ts";
import { desktop, skip, VISITOR_ZONE, type Check } from "./helpers.ts";
import { basePath } from "../../src/shared/url.ts";
import { serve } from "./server.ts";
import { readSite } from "./site.ts";

const server = await serve({ base: basePath(config.url) });
const browser = await chromium.launch();
const site = await readSite(browser, server.home);

const checks: Check[] = [home, ask, chats, sidebar, figures, viewer, views].flatMap((group) => group(site));
let skipped = 0;
if (!site.languages.length) {
  skipped++;
  skip("another language's page", "the site is in one language");
}

const problems: string[] = [];
let passed = 0;
for (const { name, url, device = desktop, skip: why, allowAsk = false, test } of checks) {
  if (why) {
    skipped++;
    skip(name, why);
    continue;
  }
  const context = await browser.newContext({ timezoneId: VISITOR_ZONE, ...device });
  // What a check waits for comes in well under this; it only bounds a failure.
  context.setDefaultTimeout(10_000);
  const page = await context.newPage();
  page.on("pageerror", (error) => problems.push(`${name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (allowAsk && message.location().url === site.askUrl) return;
    problems.push(`${name}: ${message.text()}`);
  });
  await page.goto(site.url(url));
  try {
    await test(page);
    passed++;
    console.log(`ok   ${name}`);
  } catch (error) {
    problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`FAIL ${name}`);
  }
  await context.close();
}

await browser.close();
await server.close();
const summary = `${passed} checks passed${skipped ? `, ${skipped} skipped` : ""}`;
if (problems.length) {
  const count = `${problems.length} problem${problems.length > 1 ? "s" : ""}`;
  console.error(`\n${summary}; ${count}:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nAll ${summary}.`);
