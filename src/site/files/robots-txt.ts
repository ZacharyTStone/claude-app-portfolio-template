/* robots.txt, which points crawlers at the sitemap. */

import { SITEMAP_FILE } from "../constants.ts";
import type { Site } from "../site.ts";

/** robots.txt, as the text of the file: every crawler may read everything,
    and the sitemap is at its full address. */
export const robotsTxt = (site: Site): string =>
  `User-agent: *\nAllow: /\n\nSitemap: ${site.address(`/${SITEMAP_FILE}`)}\n`;
