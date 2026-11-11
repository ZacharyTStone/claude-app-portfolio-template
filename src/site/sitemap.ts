/* sitemap.xml, with every page's hreflang pairs, and robots.txt, which
   points crawlers at it. */

import { FILES } from "./constants.ts";
import type { Site } from "./site.ts";

/** Text that's safe in XML, as content or in a quoted attribute. */
const xml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function sitemap(site: Site): string {
  const { codes, main } = site;
  const links = codes
    .map((c) => `    <xhtml:link rel="alternate" hreflang="${xml(c)}" href="${xml(site.url(c))}" />`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xml(site.url(main))}" />`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${codes.map((c) => `  <url>\n    <loc>${xml(site.url(c))}</loc>\n${links}\n  </url>`).join("\n")}
</urlset>
`;
}

export const robots = (site: Site): string =>
  `User-agent: *\nAllow: /\n\nSitemap: ${site.address(`/${FILES.sitemap}`)}\n`;
