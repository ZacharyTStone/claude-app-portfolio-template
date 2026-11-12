/* /ask.json, what /ask picks from: every answer on the site as plain
   text. Written only when Ask is on. */
import { basename } from "node:path";
import { ASK_INDEX_FILE } from "../shared/ask.ts";
import { askIndexJson } from "../site/answers.ts";
import { site } from "../site/current.ts";

/** This route's one parameter: the index's file name without the ".json"
    that this file's own name puts back ("ask", for /ask.json). */
const INDEX_NAME = basename(ASK_INDEX_FILE, ".json");

/** The files this route writes: the index on a site with Ask on, and none
    on any other. */
export const getStaticPaths = () => (site.config.ask ? [{ params: { index: INDEX_NAME } }] : []);

/** The file, written once as the site is built. */
export const GET = () => new Response(askIndexJson(site));
