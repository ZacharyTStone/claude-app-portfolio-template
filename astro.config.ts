/* Astro builds the site from site.config.ts (or the file SITE_CONFIG names)
   into dist/: static HTML with no script but the site's own and nothing
   inline, so the Content-Security-Policy in src/shared/headers.ts holds. */
import { defineConfig } from "astro/config";
import { checkConfig } from "./src/integrations/check-config.ts";
import { hostFiles } from "./src/integrations/host-files.ts";
import { loadSiteConfig } from "./src/integrations/site-config.ts";
import { basePath } from "./src/shared/url.ts";

const { name, file, config } = await loadSiteConfig();
// An address that isn't one is for the config's check to report, in words.
const url = URL.canParse(config.url) ? config.url : "http://localhost";

export default defineConfig({
  site: new URL(url).origin,
  base: basePath(url),
  trailingSlash: "always",
  // Styles and scripts are files of their own, never inline: the policy
  // allows nothing inline.
  build: { inlineStylesheets: "never" },
  vite: {
    build: { assetsInlineLimit: 0 },
    // What the pages import as site.config.ts (in src/site/current.ts) is
    // the config being built.
    resolve: { alias: [{ find: /^(?:\.\.\/)+site\.config\.ts$/, replacement: file }] },
  },
  integrations: [checkConfig(config, name), hostFiles(config)],
  devToolbar: { enabled: false },
});
