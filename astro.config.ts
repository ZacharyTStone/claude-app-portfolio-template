/* Astro builds the site from site.config.ts (or the file SITE_CONFIG names)
   into dist/: static HTML with no script but the site's own and nothing
   inline, so the Content-Security-Policy in src/shared/headers.ts holds. */
import { defineConfig } from "astro/config";
import { checkConfig } from "./src/integrations/check-config.ts";
import { hostFiles } from "./src/integrations/host-files.ts";
import { loadSiteConfig } from "./src/integrations/site-config.ts";
import { basePath } from "./src/shared/url.ts";

const { fileName, filePath, config } = await loadSiteConfig();

/** The address Astro is given when the config's own isn't one, so that this
    file loads and the config's check can report the address, in words. */
const ADDRESS_UNTIL_CHECKED = "http://localhost";
const siteAddress = URL.canParse(config.url) ? config.url : ADDRESS_UNTIL_CHECKED;

/** An import of the config from anywhere under src/, by its path from the
    importing file: "../../site.config.ts". */
const IMPORT_OF_SITE_CONFIG = /^(?:\.\.\/)+site\.config\.ts$/;

export default defineConfig({
  site: new URL(siteAddress).origin,
  base: basePath(siteAddress),
  trailingSlash: "always",
  // Styles and scripts are files of their own, never inline: the policy
  // allows nothing inline.
  build: { inlineStylesheets: "never" },
  vite: {
    // Nor is a small picture or font written into the file that uses it, as
    // a data: address: the policy allows only files of the site's own.
    build: { assetsInlineLimit: 0 },
    // What the pages import as site.config.ts (in src/site/current.ts) is
    // the config being built.
    resolve: { alias: [{ find: IMPORT_OF_SITE_CONFIG, replacement: filePath }] },
  },
  integrations: [checkConfig(config, fileName), hostFiles(config)],
  devToolbar: { enabled: false },
});
