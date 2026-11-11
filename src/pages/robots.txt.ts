/* /robots.txt, which points crawlers at the sitemap. */
import { robots } from "../site/sitemap.ts";
import { site } from "../site/current.ts";

export const GET = () => new Response(robots(site));
