/* The sites the checks run on, one to a Playwright project. */
import { join } from "node:path";
import siteConfig from "../../site.config.ts";
import type { SiteConfig } from "../../src/config/site-config.ts";
import { OUTPUT, ROOT } from "../../src/site/repo.ts";

export type SiteUnderTest = {
  config: SiteConfig;
  /** The folder it's built into. */
  builtFolder: string;
};

/** The repo's own site, as `npm run build` builds it. */
export const OWN_SITE: SiteUnderTest = { config: siteConfig, builtFolder: join(ROOT, OUTPUT) };
