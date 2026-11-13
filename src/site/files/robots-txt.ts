/* robots.txt, which points crawlers at the sitemap. */

import type { Site } from "../site.ts";
import { SITEMAP_FILE } from "./sitemap-xml.ts";

/** robots.txt, as the text of the file: every crawler may read everything,
    and the sitemap is at its full address. */
export const robotsTxt = (site: Site): string =>
  `User-agent: *\nAllow: /\n\nSitemap: ${site.address(`/${SITEMAP_FILE}`)}\n`;
