import { site } from "../site/current.ts";
import { robotsTxt } from "../site/files/robots-txt.ts";

export const GET = () => new Response(robotsTxt(site));
