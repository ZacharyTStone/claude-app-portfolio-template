/* The sample as a site Netlify serves (tests/sample/site.config.ts, with
   host "netlify"): Netlify Forms takes its contact form's messages, and it
   has no Ask, which only Cloudflare runs. */
import type { SiteConfig } from "../../src/config/site-config.ts";
import sample from "./site.config.ts";

/** The change to the sample's config, for a file of a test's own
    (writeSampleConfig). */
export const ON_NETLIFY = 'config.host = "netlify"; delete config.ask;';

/** The same config, as an object. */
export const sampleOnNetlify: SiteConfig = { ...sample, host: "netlify", ask: undefined };
