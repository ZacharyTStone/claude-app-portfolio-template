import { defineConfig } from "@playwright/test";
import { OWN_SITE, SAMPLE_SITE, type SiteUnderTest } from "./tests/browser/sites.ts";

/** How long a check waits for the page to do what it should, in
    milliseconds: far longer than the page takes, so it only bounds a
    failure. */
const WAIT_LIMIT_MS = 10_000;

export default defineConfig<object, { siteUnderTest: SiteUnderTest }>({
  testDir: "tests/browser",
  globalSetup: "./tests/browser/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["./tests/browser/skip-reasons.ts"]],
  expect: { timeout: WAIT_LIMIT_MS },
  use: {
    viewport: { width: 1440, height: 900 },
    // Where every check's visitor is, so the time-of-day checks know what to expect.
    timezoneId: "America/New_York",
    actionTimeout: WAIT_LIMIT_MS,
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "site", use: { siteUnderTest: OWN_SITE } },
    { name: "sample", use: { siteUnderTest: SAMPLE_SITE } },
  ],
});
