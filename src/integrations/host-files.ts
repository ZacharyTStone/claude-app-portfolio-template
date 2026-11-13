/* Writes the host's _headers file beside the pages once they're built,
   for a host that reads one (src/site/files/headers-file.ts). */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { SiteConfig } from "../config/site-config.ts";
import { HEADERS_FILE } from "../site/constants.ts";
import { headersFile } from "../site/files/headers-file.ts";
import { makeSite } from "../site/site.ts";

/** The Astro integration that adds the security headers' file to a
    finished build of `config`. A host that reads no such file gets none:
    its pages carry the policy themselves. */
export function hostFiles(config: SiteConfig): AstroIntegration {
  return {
    name: "host-files",
    hooks: {
      "astro:build:done": ({ dir: outputFolder }) => {
        const headers = headersFile(makeSite(config));
        if (headers === null) return;
        writeFileSync(fileURLToPath(new URL(HEADERS_FILE, outputFolder)), headers);
      },
    },
  };
}
