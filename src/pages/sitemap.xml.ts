import { site } from "../site/current.ts";
import { sitemapXml } from "../site/files/sitemap-xml.ts";

export const GET = () => new Response(sitemapXml(site));
