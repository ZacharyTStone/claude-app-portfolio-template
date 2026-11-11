/* Which config Astro builds: site.config.ts, or another file that the
   SITE_CONFIG environment variable names (from the repo's root), as the
   tests do to build a sample site (tests/sample-site.test.ts). */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SiteConfig } from "../shared/config.ts";
import { ROOT } from "../site/constants.ts";

/** The environment variable that names another config to build. */
export const SITE_CONFIG = "SITE_CONFIG";

/** The config to build, the file it's in, and that file as it was named. */
export async function loadSiteConfig(): Promise<{ name: string; file: string; config: SiteConfig }> {
  const name = process.env[SITE_CONFIG] || "site.config.ts";
  const file = resolve(ROOT, name);
  // A file named at run time: Vite can't follow it, and needn't.
  const { default: config } = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as { default: SiteConfig };
  return { name, file, config };
}
