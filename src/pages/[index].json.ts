/* /ask.json, what /ask picks from: every answer on the site as plain
   text. Written only when Ask is on. */
import { askIndex } from "../site/answers.ts";
import { ASK_INDEX_FILE } from "../shared/ask.ts";
import { site } from "../site/current.ts";

const { ask } = site.config;

export const getStaticPaths = () => (ask ? [{ params: { index: ASK_INDEX_FILE.replace(/\.json$/, "") } }] : []);

export const GET = () => new Response(askIndex(site, ask?.role ?? ""));
