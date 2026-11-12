/* The site every page and file is built from: site.config.ts (or the file
   SITE_CONFIG names, which astro.config.ts puts in its place), and what's
   worked out from it (site.ts). The config is checked before a build
   starts (src/integrations/check-config.ts). */
import config from "../../site.config.ts";
import { makeSite } from "./site.ts";

/** The site being built. Components and routes import this one; code that
    has to work on any config (the checks, the tests) takes a Site as an
    argument instead. */
export const site = makeSite(config);
