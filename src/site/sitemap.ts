/* sitemap.xml, with every page's hreflang pairs, and robots.txt, which
   points crawlers at it. */

import { SITEMAP_FILE } from "./constants.ts";
import type { Site } from "./site.ts";

/** Text made safe in XML, as content or inside a double-quoted attribute:
    the four characters XML reads as markup there are written as entities.
    The & goes first, or it would rewrite the entities the others make. */
const xmlSafe = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** sitemap.xml, as the text of the file: every language's page, each with
    a link to itself and the others by language (hreflang), and to the main
    one for any language the site doesn't have (x-default). */
export function sitemapXml(site: Site): string {
  const { codes, main } = site;
  const alternate = (hreflang: string, pageUrl: string) =>
    `    <xhtml:link rel="alternate" hreflang="${xmlSafe(hreflang)}" href="${xmlSafe(pageUrl)}" />`;
  // The same on every page: search engines want each page to list them all, itself included.
  const alternates = [...codes.map((code) => alternate(code, site.url(code))), alternate("x-default", site.url(main))];
  const pages = codes.map((code) =>
    ["  <url>", `    <loc>${xmlSafe(site.url(code))}</loc>`, ...alternates, "  </url>"].join("\n"),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages.join("\n")}
</urlset>
`;
}

/** robots.txt, as the text of the file: every crawler may read everything,
    and the sitemap is at its full address. */
export const robotsTxt = (site: Site): string =>
  `User-agent: *\nAllow: /\n\nSitemap: ${site.address(`/${SITEMAP_FILE}`)}\n`;
