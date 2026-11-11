/* /sitemap.xml, with every page's hreflang pairs. */
import { sitemap } from "../site/sitemap.ts";
import { site } from "../site/current.ts";

export const GET = () => new Response(sitemap(site));
