/* Checks the config before anything is built: every thread, icon and
   link it points at exists, and its languages match (src/site/validate.ts).
   A problem stops the build, and the message lists each one. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { SiteConfig } from "../shared/config.ts";
import { makeSite } from "../site/site.ts";
import { iconsIn, validate } from "../site/validate.ts";

/** `name` is the config's file, for the message. */
export function checkConfig(config: SiteConfig, name: string): AstroIntegration {
  return {
    name: "check-config",
    hooks: {
      "astro:config:setup": ({ config: astro, logger }) => {
        // The icons a config can name are the .i-* classes in the stylesheet.
        const styles = fileURLToPath(new URL("src/styles", astro.root));
        const css = readdirSync(styles)
          .map((file) => readFileSync(join(styles, file), "utf8"))
          .join("\n");
        const { problems, notes } = validate(makeSite(config), iconsIn(css));
        for (const note of notes) logger.warn(`${note}.`);
        if (problems.length) throw new Error(`${name} has problems:\n- ${problems.join("\n- ")}`);
      },
    },
  };
}
