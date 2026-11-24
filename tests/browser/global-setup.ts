/* What the checks need before any of them runs. Each is asked for in one
   sentence that says how to get it, in place of a stack trace from the
   first check to miss it. */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { OUTPUT, ROOT } from "../../src/site/repo.ts";
import { writeSampleConfig } from "../sample/as-a-file.ts";
import { buildSample } from "../sample/build.ts";
import { ON_NETLIFY } from "../sample/on-netlify.ts";
import { CHECKS_THE_SAMPLE, SAMPLE_BUILT_IN, SAMPLE_ON_NETLIFY_BUILT_IN } from "./sites.ts";

/** Stops the run, saying only `whatToDo`: where in this file it stopped
    would tell the reader nothing. */
function stop(whatToDo: string): never {
  const error = new Error(whatToDo);
  error.stack = whatToDo;
  throw error;
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

/** Builds the sample site into a folder of its own, as it is or after
    `change` to its config (writeSampleConfig), whose file is in a folder of
    its own. Says where it built it, and every folder it made. */
function buildTheSample(change?: string): { builtIn: string; made: string[] } {
  const builtIn = mkdtempSync(join(tmpdir(), "browser-checks-sample-"));
  const made = [builtIn];
  let configFile: string | undefined;
  if (change !== undefined) {
    const configFolder = mkdtempSync(join(tmpdir(), "browser-checks-sample-config-"));
    made.push(configFolder);
    configFile = join(configFolder, "site.config.ts");
    writeSampleConfig(configFile, change);
  }
  const build = buildSample(builtIn, configFile);
  if (build.status !== 0) stop(`The sample site the browser checks also run on didn't build:\n${build.stderr}`);
  return { builtIn, made };
}

type Teardown = () => void;

export default async function globalSetup(): Promise<Teardown | undefined> {
  requireTheBuiltSite();
  await requireChromium();
  if (!CHECKS_THE_SAMPLE) return undefined;
  // One after the other: Astro's builds share its working folder.
  const sample = buildTheSample();
  const onNetlify = buildTheSample(ON_NETLIFY);
  process.env[SAMPLE_BUILT_IN] = sample.builtIn;
  process.env[SAMPLE_ON_NETLIFY_BUILT_IN] = onNetlify.builtIn;
  return () => {
    for (const folder of [...sample.made, ...onNetlify.made]) rmSync(folder, { recursive: true, force: true });
  };
}
