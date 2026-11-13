/* Which config Astro builds: site.config.ts, or another file that the
   SITE_CONFIG environment variable names (from the repo's root), as the
   tests do to build a sample site (tests/sample-site.test.ts). */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SiteConfig } from "../config/site-config.ts";
import { ROOT } from "./repo.ts";

/** The environment variable that names another config to build. */
export const SITE_CONFIG = "SITE_CONFIG";

/** The config that's built when SITE_CONFIG names none, from the repo's root. */
const DEFAULT_CONFIG_FILE = "site.config.ts";

/** The config a build is for, and where it came from. */
export type LoadedSiteConfig = {
  /** The config's file as it was named: "site.config.ts", or SITE_CONFIG's
      value as it was typed. It starts the message when the config has
      problems. */
  fileName: string;
  /** The same file as a full path, for Vite to load in the place of
      site.config.ts. */
  filePath: string;
  /** What that file exports as its default. */
  config: SiteConfig;
};

/** Loads the config to build. A path in SITE_CONFIG is from the repo's
    root, unless it's a full path. */
export async function loadSiteConfig(): Promise<LoadedSiteConfig> {
  const fileName = process.env[SITE_CONFIG] || DEFAULT_CONFIG_FILE;
  const filePath = resolve(ROOT, fileName);
  // A file named at run time: Vite can't follow it, and needn't.
  const configModule = (await import(/* @vite-ignore */ pathToFileURL(filePath).href)) as { default: SiteConfig };
  return { fileName, filePath, config: configModule.default };
}
