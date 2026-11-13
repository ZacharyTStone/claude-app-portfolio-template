/* /sitemap.xml, with every page's hreflang pairs. */
import { site } from "../site/current.ts";
import { sitemapXml } from "../site/files/sitemap-xml.ts";

/** The file, written once as the site is built. */
export const GET = () => new Response(sitemapXml(site));
