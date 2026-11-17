/* The details panel's Context, gathered from the answers, on a language
   whose panel.context has `fromAnswers`: what each tab's answers link to,
   as rows, the way the Claude app lists a conversation's sources. A tab's
   list is what its questions and answers link to, each address once, in
   the order the tab first links to it. A chat lists the rows of the tabs
   its answers are from (src/app/panel-context.ts), and the home screen
   none. Only what a visitor can open is listed: a web address, or a file
   on the site. A link to one of the site's own pages (#about, /about/)
   and mailto: are left out, and so is a link one of the config's own rows
   has, which stays that row. The Writing tab's posts are left out too: its
   answer is that list already, fetched, not the config's. llms.txt lists
   every link on the site the same way (linksOfTheSite). */

import { isTextBlock, picturesIn, type Block } from "../config/blocks.ts";
import type { PanelRow } from "../config/language.ts";
import { linksIn } from "../config/markdown.ts";
import { personalTabId } from "../contracts/page-ids.ts";
import type { Site, SiteLanguage } from "./site.ts";
import { basePath, shortUrl } from "./url.ts";

/** A list of the Context: the tab whose links it is (its id). */
export type GatheredList = { of: string; rows: PanelRow[] };

/** A link where an answer has it: its href as the config writes it, and
    its words: a link card's name (with the card's icon) or a link's text.
    A picture's link has none: its caption says what the picture shows,
    not where it links. */
type FoundLink = { href: string; words?: string; icon?: string };

/** The logos a row can have, by the host of where it links. Any other web
    address is a globe, and a file on the site a file. */
const LOGO_BY_HOST: Array<{ host: RegExp; icon: string }> = [
  { host: /^github\.com$/, icon: "github" },
  { host: /(^|\.)linkedin\.com$/, icon: "linkedin" },
];

/** What a host reads as: "linkedin.com" for "www.linkedin.com". */
const hostAsWritten = (url: URL): string => url.hostname.replace(/^www\./, "");

/** The last part of a path has a dot in it: "/assets/resume.pdf", not
    "/about/". */
const namesAFile = (pathname: string): boolean => /\.[^/]*$/.test(pathname);

function linksInBlock(block: Block): FoundLink[] {
  if (typeof block === "string") return linksIn(block).map(({ href, text }) => ({ href, words: text }));
  if (isTextBlock(block)) return block.flatMap(linksInBlock);
  if ("link" in block) return [{ href: block.link.href, words: block.link.name, icon: block.link.icon }];
  return picturesIn(block).flatMap((picture) => (picture.href ? [{ href: picture.href }] : []));
}

/** A question and its answer, the question first. */
const linksInMessage = (q: string, answer: Block[]): FoundLink[] => [q, ...answer].flatMap(linksInBlock);

/** Each tab with a page and what it links to: each thread but the Writing
    tab, then each personal answer, in the page's order. */
function linksOfEachTab(language: SiteLanguage): Array<{ tab: string; links: FoundLink[] }> {
  const threads = language.threads
    .filter((thread) => !thread.fetched)
    .map((thread) => ({ tab: thread.id, links: thread.messages.flatMap((m) => linksInMessage(m.q, m.a)) }));
  const personalAnswers = language.questions.personal.map((answer) => ({
    tab: personalTabId(answer.id),
    links: linksInMessage(answer.q, answer.a),
  }));
  return [...threads, ...personalAnswers];
}

/** Where a link goes, as a full address: a path on the site under the
    site's own path, as the pages link to it. Undefined for what isn't an
    address. */
function fullAddress(site: Site, href: string): URL | undefined {
  const { url } = site.config;
  const asLinked = site.link(href);
  return URL.canParse(url) && URL.canParse(asLinked, url) ? new URL(asLinked, url) : undefined;
}

/** Whether an address is on the site: at its origin, under its path. */
function isOnTheSite(site: Site, address: URL): boolean {
  const siteAddress = new URL(site.config.url);
  return address.origin === siteAddress.origin && `${address.pathname}/`.startsWith(basePath(site.config.url));
}

/** Where a link goes, if it's one the Context lists: a web address, or a
    file on the site. Undefined for a page of the site, #anything, mailto:
    and anything else. */
function addressListed(site: Site, href: string): URL | undefined {
  const address = href.startsWith("#") ? undefined : fullAddress(site, href);
  if (!address || !/^https?:$/.test(address.protocol)) return undefined;
  return isOnTheSite(site, address) && !namesAFile(address.pathname) ? undefined : address;
}

/** The same address however it's written: "https://Example.com" is
    "https://example.com/". */
const sameAddress = (site: Site, href: string): string => fullAddress(site, href)?.href ?? href;

/** A row's icon, without a link card's: GitHub's or LinkedIn's by the
    host, a file's for a file on the site, and a globe's for any other. */
const iconOf = (site: Site, address: URL): string =>
  LOGO_BY_HOST.find((logo) => logo.host.test(hostAsWritten(address)))?.icon ??
  (isOnTheSite(site, address) ? "file" : "globe");

/** The link that names an address's row: a link card to it, wherever the
    card is, or else the first link to it with words, or else the first. */
const namingLink = (links: [FoundLink, ...FoundLink[]]): FoundLink =>
  links.find((link) => link.icon) ?? links.find((link) => link.words?.trim()) ?? links[0];

/** A row for an address, from each link to it: named by its naming link's
    words, or else by the address itself, short; the host on the right, but
    for a row whose name starts with it; with a link card's icon, or else
    one by the address. */
function rowOf(site: Site, address: URL, links: [FoundLink, ...FoundLink[]]): PanelRow {
  const named = namingLink(links);
  const label = named.words?.trim() || shortUrl(address.href);
  const host = hostAsWritten(address);
  return {
    label,
    meta: label.startsWith(host) ? "" : host,
    icon: named.icon ?? iconOf(site, address),
    href: named.href,
  };
}

/** The rows for these links, an address once, where it's first linked to,
    leaving out any the config's own rows (`ownRows`) have. A row without
    an href takes no address. */
function rowsOf(site: Site, links: FoundLink[], ownRows: PanelRow[]): PanelRow[] {
  const ownAddresses = new Set(ownRows.flatMap((row) => (row.href ? [sameAddress(site, row.href)] : [])));
  const linksTo = new Map<string, { address: URL; links: [FoundLink, ...FoundLink[]] }>();
  for (const link of links) {
    const address = addressListed(site, link.href);
    const key = sameAddress(site, link.href);
    if (!address || ownAddresses.has(key)) continue;
    const listed = linksTo.get(key);
    if (listed) listed.links.push(link);
    else linksTo.set(key, { address, links: [link] });
  }
  return [...linksTo.values()].map((listed) => rowOf(site, listed.address, listed.links));
}

/** A language's lists for its Context: each tab's that has a link to
    list. None for a language whose panel.context hasn't `fromAnswers`. */
export function contextLists(site: Site, code: string): GatheredList[] {
  const language = site.language(code);
  const context = language.panel.context;
  if (!context?.fromAnswers) return [];
  const lists = linksOfEachTab(language).map((tab) => ({ of: tab.tab, rows: rowsOf(site, tab.links, context.rows) }));
  return lists.filter((list) => list.rows.length > 0);
}

/** Every link on a language's pages, as rows, as a tab's are: the home
    screen's intro, each tab, then "Something else". None for a language
    whose panel.context hasn't `fromAnswers`. */
export function linksOfTheSite(site: Site, code: string): PanelRow[] {
  const language = site.language(code);
  const context = language.panel.context;
  if (!context?.fromAnswers) return [];
  const everywhere = [
    ...linksInBlock(language.home.intro),
    ...linksOfEachTab(language).flatMap((tab) => tab.links),
    ...linksInBlock(language.asked.answer),
  ];
  return rowsOf(site, everywhere, context.rows);
}
