import config from "../../site.config.ts";
import repos from "./activity/fetched.ts";
import history from "./history/fetched.ts";
import { makeSite } from "./site.ts";
import fetched from "./writing/fetched.ts";

/** The site being built: site.config.ts, or the file SITE_CONFIG names,
    which astro.config.ts puts in its place, with the Writing tab's posts,
    the panel's activity and the GitHub history as the build fetched
    them (src/integrations/writing.ts, src/integrations/activity.ts,
    src/integrations/history.ts). Components and
    routes import this one. What has to work on any config (the checks, the
    tests) takes a Site as an argument instead. */
export const site = makeSite(config, fetched, repos, history);
