/* /llms.txt: the site as plain text, for a model reading it on someone's
   behalf. */
import { site } from "../site/current.ts";
import { llmsTxt } from "../site/llms.ts";

/** The file, written once as the site is built. */
export const GET = () => new Response(llmsTxt(site));
