/* Writes the host's _headers file beside the pages once they're built,
   for a host that reads one (src/site/hosts.ts). */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { SiteConfig } from "../shared/config.ts";
import { headersFile } from "../site/hosts.ts";
import { makeSite } from "../site/site.ts";

export function hostFiles(config: SiteConfig): AstroIntegration {
  return {
    name: "host-files",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const headers = headersFile(makeSite(config));
        if (headers) writeFileSync(fileURLToPath(new URL("_headers", dir)), headers);
      },
    },
  };
}
