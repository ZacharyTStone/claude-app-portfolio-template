/* /llms.txt: the site as plain text, for a model reading it on someone's
   behalf. */
import { llms } from "../site/llms.ts";
import { site } from "../site/current.ts";

export const GET = () => new Response(llms(site));
