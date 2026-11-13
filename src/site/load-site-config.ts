/* Which config Astro builds: site.config.ts, or the file the SITE_CONFIG
   environment variable names, as the tests do to build the sample site. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SiteConfig } from "../config/site-config.ts";
import { ROOT } from "./repo.ts";

export const SITE_CONFIG = "SITE_CONFIG";

const DEFAULT_CONFIG_FILE = "site.config.ts";

export type LoadedSiteConfig = {
  /** The config's file as it was named: "site.config.ts", or SITE_CONFIG's
      value as it was typed. The config's problems are listed under it. */
  fileName: string;
  /** The same file as a full path. */
  filePath: string;
  /** What the file exports as its default. */
  config: SiteConfig;
};

/** A path in SITE_CONFIG is from the repo's root, unless it's a full path. */
export async function loadSiteConfig(): Promise<LoadedSiteConfig> {
  const fileName = process.env[SITE_CONFIG] || DEFAULT_CONFIG_FILE;
  const filePath = resolve(ROOT, fileName);
  // A file named at run time: Vite can't follow it, and needn't.
  const configModule = (await import(/* @vite-ignore */ pathToFileURL(filePath).href)) as { default: SiteConfig };
  return { fileName, filePath, config: configModule.default };
}
