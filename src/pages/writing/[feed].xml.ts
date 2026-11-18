/* The Writing tab's feed, beside the tab's page (src/site/files/writing-feed.ts), on a site that has the tab:
   "/writing/feed.xml", as this file's folder and name have it. A route with a parameter can write no file at
   all, which a site without the tab needs of this one. */
import { basename } from "node:path";
import { site } from "../../site/current.ts";
import { hasWritingFeed, WRITING_FEED_FILE, WRITING_FEED_TYPE, writingFeedXml } from "../../site/files/writing-feed.ts";

/** This route's one parameter: the file's name without the ".xml" that this file's own name puts back. */
const FEED_NAME = basename(WRITING_FEED_FILE, ".xml");

export const getStaticPaths = () => (hasWritingFeed(site) ? [{ params: { feed: FEED_NAME } }] : []);

export const GET = () =>
  new Response(writingFeedXml(site), { headers: { "content-type": `${WRITING_FEED_TYPE}; charset=utf-8` } });
