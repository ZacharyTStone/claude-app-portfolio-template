/* sitemap.xml, with every page's hreflang pairs. */

import type { Site } from "../site.ts";

/** At the site's root: robots.txt points crawlers at it, and the route that
    writes it is named for it (src/pages/sitemap.xml.ts). */
export const SITEMAP_FILE = "sitemap.xml";

/** Safe as XML's content or inside a double-quoted attribute. The & goes
    first, or it would rewrite the entities the others make. */
const xmlSafe = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Every language's page, each with a link to every one by language
    (hreflang), and to the main one for any language the site doesn't have
    (x-default). */
export function sitemapXml(site: Site): string {
  const { codes, main } = site;
  const alternate = (hreflang: string, pageUrl: string) =>
    `    <xhtml:link rel="alternate" hreflang="${xmlSafe(hreflang)}" href="${xmlSafe(pageUrl)}" />`;
  // The same on every page: search engines want each page to list them all, itself included.
  const alternates = [
    ...codes.map((code) => alternate(code, site.pageUrl(code))),
    alternate("x-default", site.pageUrl(main)),
  ];
  const pages = codes.map((code) =>
    ["  <url>", `    <loc>${xmlSafe(site.pageUrl(code))}</loc>`, ...alternates, "  </url>"].join("\n"),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages.join("\n")}
</urlset>
`;
}
