import { site } from "../site/current.ts";
import { llmsTxt } from "../site/files/llms-txt.ts";

export const GET = () => new Response(llmsTxt(site));
