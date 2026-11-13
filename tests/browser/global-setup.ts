/* What the checks need before any of them runs. Each is asked for in one
   sentence that says how to get it, in place of a stack trace from the
   first check to miss it. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { OUTPUT, ROOT } from "../../src/site/constants.ts";

/** Stops the run, saying only `whatToDo`. */
function stop(whatToDo: string): never {
  console.error(`\n${whatToDo}\n`);
  process.exit(1);
}

function requireTheBuiltSite(): void {
  if (!existsSync(join(ROOT, OUTPUT, "index.html"))) {
    stop(`There is no built site in ${OUTPUT}/ for the browser checks to open: run \`npm run build\` first.`);
  }
}

// How Playwright's own error starts when the browser it would launch isn't on the machine.
const NO_BROWSER_INSTALLED = "Executable doesn't exist";

async function requireChromium(): Promise<void> {
  const launched = await chromium.launch().catch((whyNot: Error) => whyNot);
  if (!(launched instanceof Error)) return launched.close();
  if (!launched.message.includes(NO_BROWSER_INSTALLED)) throw launched;
  stop("Playwright's Chromium isn't installed: run `npx playwright install chromium`.");
}

export default async function globalSetup(): Promise<void> {
  requireTheBuiltSite();
  await requireChromium();
}
