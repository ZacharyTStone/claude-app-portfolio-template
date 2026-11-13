/* Checks the config before anything is built: that it type-checks, then
   what types can't say (src/site/checks). A problem stops the build, and
   the message lists each one. */
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { SiteConfig } from "../config/site-config.ts";
import { checkSite } from "../site/checks/check-site.ts";
import { typeCheck } from "../site/checks/config-types.ts";
import type { Findings } from "../site/checks/reporting.ts";
import { iconsIn, readStylesheet, STYLES_FOLDER } from "../site/icons.ts";
import type { LoadedSiteConfig } from "../site/load-site-config.ts";
import { makeSite } from "../site/site.ts";

/** What the config's checks find in a config whose shape is right. */
const checkedFindings = (config: SiteConfig, root: string): Findings =>
  checkSite(makeSite(config), iconsIn(readStylesheet(join(root, STYLES_FOLDER))));

/** Checks a config's types, then the config. The checks read it as its
    types describe it, so they don't run on one whose shape is wrong. */
function typedFindings(config: SiteConfig, filePath: string, root: string): Findings {
  const { problems } = typeCheck(filePath, root);
  return problems.length ? { problems, notes: [] } : checkedFindings(config, root);
}

/** The Astro integration that checks the config Astro was started with. */
export function checkConfig({ fileName, filePath, config }: LoadedSiteConfig): AstroIntegration {
  return {
    name: "check-config",
    hooks: {
      "astro:config:setup": ({ config: astroConfig, command, logger }) => {
        const root = fileURLToPath(astroConfig.root);
        // `astro check` runs the type checker itself, and a preview builds nothing.
        const buildsPages = command === "build" || command === "dev";
        const { problems, notes } = buildsPages ? typedFindings(config, filePath, root) : checkedFindings(config, root);
        for (const note of notes) logger.warn(`${note}.`);
        if (problems.length) throw new Error(`${fileName} has problems:\n- ${problems.join("\n- ")}`);
      },
    },
  };
}
