import config from "../../site.config.ts";
import { makeSite } from "./site.ts";

/** The site being built: site.config.ts, or the file SITE_CONFIG names,
    which astro.config.ts puts in its place. Components and routes import
    this one. What has to work on any config (the checks, the tests) takes
    a Site as an argument instead. */
export const site = makeSite(config);
