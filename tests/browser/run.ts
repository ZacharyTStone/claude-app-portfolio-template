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
import { join } from "node:path";
import { chromium } from "playwright";
import config from "../../site.config.ts";
import { OUTPUT, ROOT } from "../../src/site/repo.ts";
import ask from "./checks/ask.ts";
import chats from "./checks/chats.ts";
import figures from "./checks/figures.ts";
import home from "./checks/home.ts";
import sidebar from "./checks/sidebar.ts";
import viewer from "./checks/viewer.ts";
import views from "./checks/views.ts";
import { desktop, reportSkip, VISITOR_ZONE, type Check } from "./helpers.ts";
import { serve } from "./server.ts";
import { readSite } from "./site.ts";

/** The files of checks, in the order they run. */
const CHECK_FILES = [home, ask, chats, sidebar, figures, viewer, views];

/** How long a wait in a check may take, in milliseconds. What a check waits
    for comes in well under this; it only bounds a failure. */
const WAIT_LIMIT_MS = 10_000;

/** The checks' own files, as a stack trace names them, and this one among
    them. */
const CHECKS_FOLDER = "/tests/browser/";
const THIS_FILE = "/tests/browser/run.ts";

const server = await serve(config, join(ROOT, OUTPUT));
const browser = await chromium.launch();
const site = await readSite(browser, server.home);

let passed = 0;
let skipped = 0;
/** What went wrong, an entry each, starting with the name of the check it
    happened in. */
const problems: string[] = [];

for (const check of CHECK_FILES.flatMap((checksFor) => checksFor(site))) {
  if (check.skip) {
    skipped++;
    reportSkip(check.name, check.skip);
  } else if (await passes(check)) passed++;
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

/** Runs one check as a visitor in VISITOR_ZONE, in a browser context of its
    own (so nothing an earlier check stored is there), and says "ok" or
    "FAIL" with its name. It returns whether the check's test passed; why it
    didn't goes to `problems`, and so does any error in the page or its
    console, which fails the run even when the test passes. */
async function passes({ name, url, device = desktop, allowAsk = false, test }: Check): Promise<boolean> {
  const context = await browser.newContext({ timezoneId: VISITOR_ZONE, ...device });
  context.setDefaultTimeout(WAIT_LIMIT_MS);
  const page = await context.newPage();
  page.on("pageerror", (error) => problems.push(`${name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // A request to /ask that the check made fail: its own doing.
    if (allowAsk && message.location().url === site.askUrl) return;
    problems.push(`${name}: ${message.text()}`);
  });
  await page.goto(site.url(url));
  let testPassed = true;
  try {
    await test(page);
    console.log(`ok   ${name}`);
  } catch (error) {
    testPassed = false;
    problems.push(`${name}: ${whatWentWrong(error)}`);
    console.log(`FAIL ${name}`);
  }
  await context.close();
  return testPassed;
}

/** What a check's failure says, and under it where in the checks it
    happened: the step that failed, then each step that called it, as lines
    of a stack trace ("at openViewer (tests/browser/checks/viewer.ts:44:18)"). */
function whatWentWrong(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const stepsItFailedIn = (error.stack ?? "")
    .split("\n")
    .filter((line) => line.trimStart().startsWith("at ") && line.includes(CHECKS_FOLDER) && !line.includes(THIS_FILE))
    .map((line) => line.replace("file://", "").replace(ROOT, ""));
  return [error.message.trimEnd(), ...stepsItFailedIn].join("\n");
}
