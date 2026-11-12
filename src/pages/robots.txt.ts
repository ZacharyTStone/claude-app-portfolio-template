/* /robots.txt, which points crawlers at the sitemap. */
import { site } from "../site/current.ts";
import { robotsTxt } from "../site/sitemap.ts";

/** The file, written once as the site is built. */
export const GET = () => new Response(robotsTxt(site));
