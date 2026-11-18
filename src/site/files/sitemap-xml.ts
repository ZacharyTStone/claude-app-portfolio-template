/* sitemap.xml, with every page's hreflang pairs. */

import { alternatesOf, portfolioPages, type PageHead } from "../pages.ts";
import type { Site } from "../site.ts";

/** At the site's root: robots.txt points crawlers at it, and the route that
    writes it is named for it (src/pages/sitemap.xml.ts). */
export const SITEMAP_FILE = "sitemap.xml";

/** Safe as XML's content or inside a double-quoted attribute. The & goes
    first, or it would rewrite the entities the others make. */
export const xmlSafe = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** One page, with a link to each of its versions by language (hreflang),
    and to the main one's for any language the site doesn't have
    (x-default). Search engines want each version to list them all, itself
    included. */
function pageEntry(site: Site, head: PageHead): string {
  const alternates = alternatesOf(site, head).map(
    ({ hreflang, href }) =>
      `    <xhtml:link rel="alternate" hreflang="${xmlSafe(hreflang)}" href="${xmlSafe(href)}" />`,
  );
  return ["  <url>", `    <loc>${xmlSafe(site.fileUrl(head.path))}</loc>`, ...alternates, "  </url>"].join("\n");
}

/** Every page: each language's home page, and a page for each of its tabs. */
export function sitemapXml(site: Site): string {
  const pages = portfolioPages(site).map(({ head }) => pageEntry(site, head));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages.join("\n")}
</urlset>
`;
}
