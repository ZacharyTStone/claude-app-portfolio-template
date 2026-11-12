/* The names the site's files and tests share, and its limits. */

import { fileURLToPath } from "node:url";
import type { Host } from "../shared/config.ts";

/** The repo. */
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Where Astro builds the site, from the repo's root: the host serves
    this folder and nothing else. */
export const OUTPUT = "dist";

/** The sitemap's file, at the site's root: robots.txt points crawlers at
    it. (The route that writes it is named for it: src/pages/sitemap.xml.ts.) */
export const SITEMAP_FILE = "sitemap.xml";

/** The file a host reads the security headers from, beside the pages, if
    it reads one at all (hosts.ts). */
export const HEADERS_FILE = "_headers";

/** The icons every page has, paths on the site (each site's own files). */
export const ICONS = {
  svg: "/assets/favicon.svg",
  png: "/assets/favicon-32.png",
  appleTouch: "/assets/apple-touch-icon.png",
} as const;

/** Who serves the site when the config's `host` is left out. */
export const DEFAULT_HOST: Host = "cloudflare";

/** The one host that runs Ask's Worker (src/worker): Cloudflare Workers. */
export const ASK_HOST: Host = "cloudflare";

/** The question card's first step reads best with this many topics or
    fewer (plus "Something else"), on a phone above all. */
export const MAX_TOPICS = 4;

/** How much of a text one of the config's problems quotes to say which
    text it means, in characters. */
export const PROBLEM_EXCERPT_LENGTH = 40;

/** The spaces each level of the JSON the build writes is indented by
    (ask.json, a page's schema.org data), so a person can read it. */
export const JSON_INDENT = 2;

/** The schema.org Person's id, after the site's address:
    "https://example.com/#person". */
export const PERSON_FRAGMENT = "#person";
