/* The sites the checks run on, one to a Playwright project: the repo's own,
   and the made-up sample (tests/sample), which has what a starter site may
   not: Ask, a viewer, a second language, a path it's served under. The
   contact form's checks run on the sample on Netlify too, where Netlify
   Forms takes its messages. The sample's checks test the template's shared
   code on a made-up site, so they run in the template alone: a site made
   from it runs its own site's. */
import { join } from "node:path";
import { isTheTemplate } from "../../scripts/template.ts";
import siteConfig from "../../site.config.ts";
import type { SiteConfig } from "../../src/config/site-config.ts";
import { OUTPUT, ROOT } from "../../src/site/repo.ts";
import { sampleOnNetlify } from "../sample/on-netlify.ts";
import sampleConfig from "../sample/site.config.ts";

export type SiteUnderTest = {
  config: SiteConfig;
  /** The folder it's built into. */
  builtFolder: string;
};

/** Whether the checks run on the sample too: in the template, and not in a
    site made from it. */
export const CHECKS_THE_SAMPLE = isTheTemplate(ROOT);

/** The repo's own site, as `npm run build` builds it. */
export const OWN_SITE: SiteUnderTest = { config: siteConfig, builtFolder: join(ROOT, OUTPUT) };

/** The environment variable in which global-setup.ts says where it built
    the sample: a folder of its own for each run, so two runs on one
    machine never share one. */
export const SAMPLE_BUILT_IN = "BROWSER_CHECKS_SAMPLE_BUILT_IN";

/** The sample site. Its folder is known once a run has built it: in the
    workers, which start after that, and not where the checks are listed. */
export const SAMPLE_SITE: SiteUnderTest = { config: sampleConfig, builtFolder: process.env[SAMPLE_BUILT_IN] ?? "" };

/** Where global-setup.ts says it built the sample on Netlify, the same way. */
export const SAMPLE_ON_NETLIFY_BUILT_IN = "BROWSER_CHECKS_SAMPLE_ON_NETLIFY_BUILT_IN";

/** The sample as Netlify serves it (tests/sample/on-netlify.ts). */
export const SAMPLE_ON_NETLIFY: SiteUnderTest = {
  config: sampleOnNetlify,
  builtFolder: process.env[SAMPLE_ON_NETLIFY_BUILT_IN] ?? "",
};
