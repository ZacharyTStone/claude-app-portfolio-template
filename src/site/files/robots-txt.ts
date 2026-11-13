/* robots.txt, which points crawlers at the sitemap. */

import type { Site } from "../site.ts";
import { SITEMAP_FILE } from "./sitemap-xml.ts";

export const robotsTxt = (site: Site): string =>
  `User-agent: *\nAllow: /\n\nSitemap: ${site.fileUrl(`/${SITEMAP_FILE}`)}\n`;
