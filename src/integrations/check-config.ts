/* Checks the config before anything is built: every thread, icon and
   link it points at exists, and its languages match (src/site/checks).
   A problem stops the build, and the message lists each one. */
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { SiteConfig } from "../config/site-config.ts";
import { makeSite } from "../site/site.ts";
import { iconsIn, readStylesheet, STYLES_FOLDER } from "../site/icons.ts";
import { checkSite } from "../site/checks/check-site.ts";

/** The Astro integration that checks `config` as a build, or the dev
    server, starts. `configFileName` is the config's file as it was named
    ("site.config.ts"), which the message starts with. */
export function checkConfig(config: SiteConfig, configFileName: string): AstroIntegration {
  return {
    name: "check-config",
    hooks: {
      "astro:config:setup": ({ config: astroConfig, logger }) => {
        const stylesFolder = join(fileURLToPath(astroConfig.root), STYLES_FOLDER);
        const stylesheetIcons = iconsIn(readStylesheet(stylesFolder));
        const { problems, notes } = checkSite(makeSite(config), stylesheetIcons);
        for (const note of notes) logger.warn(`${note}.`);
        if (problems.length) throw new Error(problemsMessage(configFileName, problems));
      },
    },
  };
}

/** What the build prints as it stops: the config's file, then each problem
    on a line of its own. */
const problemsMessage = (configFileName: string, problems: string[]): string =>
  `${configFileName} has problems:\n- ${problems.join("\n- ")}`;
