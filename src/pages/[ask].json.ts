/* /ask.json, on a site with Ask on: what /ask picks from. */
import { basename } from "node:path";
import { ASK_INDEX_FILE } from "../contracts/ask.ts";
import { site } from "../site/current.ts";
import { askIndexJson } from "../site/files/ask-json.ts";

/** This route's one parameter: the file's name without the ".json" that
    this file's own name puts back. */
const INDEX_NAME = basename(ASK_INDEX_FILE, ".json");

/** A route with a parameter can write no file at all, which a site with
    Ask off needs of this one. */
export const getStaticPaths = () => (site.config.ask ? [{ params: { ask: INDEX_NAME } }] : []);

export const GET = () => new Response(askIndexJson(site));
