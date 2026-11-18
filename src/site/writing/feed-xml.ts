/* An RSS or Atom feed, read from its XML into the few things the Writing
   tab shows of each post: its title, its address, when it was posted and its
   tags. It reads RSS 2.0 (note, Medium, Substack, WordPress, Ameba…), RSS 1.0
   (RDF, as some older blogs have) and Atom (Hatena Blog, Blogger…). A post's
   text is never read: a feed has it as HTML, and no HTML of anyone else's
   reaches a page. Every value is text, as the XML has it once its entities
   are read. */
import { XMLParser } from "fast-xml-parser";

/** A post as a feed has it, before it's checked (feeds.ts). */
export type FeedItem = {
  title?: string;
  link?: string;
  /** As the feed writes it: RFC 822 in RSS, ISO 8601 in Atom. */
  date?: string;
  tags: string[];
};

/** A feed, read. */
export type ReadFeed = {
  /** The site the feed says it's for: RSS's channel link, Atom's alternate. */
  site?: string;
  items: FeedItem[];
};

/** Where in the XML these are lists, however many there are of them. */
const LISTS = new Set(["item", "entry", "category", "link", "dc:subject"]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  // Every value stays text: a title "2026" is a title, not a number.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // XML's own five, numbered characters ("&#8217;") and HTML's names for
  // characters ("&nbsp;"), as text; never a DTD's (readFeed refuses those).
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => LISTS.has(name),
});

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);

function listOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
}

/** An element's text: as it is, or under "#text" where it has attributes. */
function textOf(value: unknown): string | undefined {
  const text = isNode(value) ? value["#text"] : value;
  return typeof text === "string" && text.trim() ? text.trim() : undefined;
}

/** An Atom link's address, where it's to the post (or the site) itself:
    rel "alternate", or no rel. RSS's links are text. */
function linkOf(links: unknown): string | undefined {
  for (const link of listOf(links)) {
    if (!isNode(link)) return textOf(link);
    const rel = link["@rel"];
    if ((rel === undefined || rel === "alternate") && typeof link["@href"] === "string") return link["@href"];
  }
  return undefined;
}

/** RSS's categories are text; Atom's are each a term; RDF's a dc:subject. */
const tagsOf = (item: Node): string[] =>
  [...listOf(item["category"]), ...listOf(item["dc:subject"])]
    .map((tag) => (isNode(tag) && typeof tag["@term"] === "string" ? tag["@term"] : textOf(tag)))
    .filter((tag): tag is string => Boolean(tag));

const itemOf = (item: Node): FeedItem => ({
  title: textOf(item["title"]),
  link: linkOf(item["link"]),
  date: textOf(item["pubDate"] ?? item["published"] ?? item["dc:date"] ?? item["updated"]),
  tags: tagsOf(item),
});

/** Where the items are: under RSS 2.0's channel, beside RSS 1.0's, or Atom's
    feed itself, with the element that says what site it's for. */
function partsOf(document: Node): { site: unknown; items: unknown } | undefined {
  const rss = document["rss"];
  if (isNode(rss) && isNode(rss["channel"])) return { site: rss["channel"]["link"], items: rss["channel"]["item"] };
  const rdf = document["rdf:RDF"];
  if (isNode(rdf)) return { site: isNode(rdf["channel"]) ? rdf["channel"]["link"] : undefined, items: rdf["item"] };
  const atom = document["feed"];
  if (isNode(atom)) return { site: atom["link"], items: atom["entry"] };
  return undefined;
}

/** The feed in `xml`, or why it isn't one. A feed that declares entities of
    its own is refused unread: no feed needs them, and they can make a small
    file expand into a huge one. */
export function readFeed(xml: string): ReadFeed | string {
  if (/<!ENTITY/i.test(xml)) return "it declares entities of its own, which no feed needs";
  let document: unknown;
  try {
    document = parser.parse(xml);
  } catch (error) {
    return `it isn't XML (${error instanceof Error ? error.message : String(error)})`;
  }
  const parts = isNode(document) ? partsOf(document) : undefined;
  if (!parts) return "it isn't an RSS or Atom feed";
  return { site: linkOf(parts.site), items: listOf(parts.items).filter(isNode).map(itemOf) };
}
