import { site } from "../../site/current.ts";
import { expiryAfter, securityTxt } from "../../site/files/security-txt.ts";

export const GET = () => new Response(securityTxt(site, expiryAfter(new Date())));
